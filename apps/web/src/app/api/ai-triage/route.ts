import { auth } from "@clerk/nextjs/server";
import { fetchQuery } from "convex/nextjs";
import { NextResponse } from "next/server";

import type { IssueCategory, IssueSeverity } from "@/lib/types";

import { api } from "@convex/_generated/api";

// Deployed alongside the rest of the web app (Vercel), unlike the FastAPI
// service in services/api which only runs locally in this project — so this
// is the one AI-triage path that actually works in production. Never
// throws to the caller: any failure degrades to the heuristic below.

interface TriageResult {
  category: IssueCategory;
  severity: IssueSeverity;
  confidence: number;
  reasoning: string;
  source: "vision" | "text" | "heuristic";
}

const CATEGORIES: IssueCategory[] = ["pothole", "garbage", "streetlight", "other"];
const SEVERITIES: IssueSeverity[] = ["low", "medium", "high", "critical"];

function heuristicTriage(description: string): TriageResult {
  const lower = description.toLowerCase();
  let category: IssueCategory = "other";
  if (/pothole|road|asphalt|crater|sinkhole|pavement/.test(lower)) category = "pothole";
  else if (/garbage|trash|dump|litter|waste|overflow/.test(lower)) category = "garbage";
  else if (/streetlight|street light|lamp|dark|pole|bulb/.test(lower)) category = "streetlight";

  let severity: IssueSeverity = "medium";
  if (/danger|hazard|immediate|emergency|fatal|deep|blocked/.test(lower)) severity = "high";
  else if (/minor|cosmetic|small/.test(lower)) severity = "low";

  return {
    category,
    severity,
    confidence: 0.6,
    reasoning: "Estimated from your description using keyword matching (no AI key configured).",
    source: "heuristic",
  };
}

function parseGroqJson(content: string): TriageResult | null {
  try {
    const parsed = JSON.parse(content) as Record<string, unknown>;
    const category = CATEGORIES.includes(parsed.category as IssueCategory)
      ? (parsed.category as IssueCategory)
      : null;
    const severity = SEVERITIES.includes(parsed.severity as IssueSeverity)
      ? (parsed.severity as IssueSeverity)
      : null;
    if (!category || !severity) return null;
    const confidence = typeof parsed.confidence === "number" ? Math.max(0, Math.min(1, parsed.confidence)) : 0.7;
    const reasoning = typeof parsed.reasoning === "string" ? parsed.reasoning : "Analyzed by AI.";
    return { category, severity, confidence, reasoning, source: "text" };
  } catch {
    return null;
  }
}

async function callGroq(description: string, imageDataUrl: string | null): Promise<TriageResult | null> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;

  const instructions =
    "You are a civic issue triage assistant for a city government app. Classify the resident's report. " +
    'Return ONLY a JSON object: {"category": "pothole"|"garbage"|"streetlight"|"other", ' +
    '"severity": "low"|"medium"|"high"|"critical", "confidence": 0-1, "reasoning": "one short sentence"}.';

  try {
    if (imageDataUrl) {
      // Vision-capable path: only taken when a photo was provided.
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "llama-4-scout-17b-16e-instruct",
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: `${instructions}\n\nResident's description: "${description}"` },
                { type: "image_url", image_url: { url: imageDataUrl } },
              ],
            },
          ],
          response_format: { type: "json_object" },
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const result = parseGroqJson(data.choices?.[0]?.message?.content ?? "");
        if (result) return { ...result, source: "vision" };
      }
    }

    // Text-only path: either no photo, or the vision call above failed.
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [{ role: "user", content: `${instructions}\n\nResident's description: "${description}"` }],
        response_format: { type: "json_object" },
      }),
    });
    if (res.ok) {
      const data = await res.json();
      return parseGroqJson(data.choices?.[0]?.message?.content ?? "");
    }
  } catch {
    // Fall through to heuristic.
  }
  return null;
}

export async function POST(req: Request) {
  const { userId, getToken } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const description = typeof body?.description === "string" ? body.description.trim() : "";
  const imageDataUrl = typeof body?.imageDataUrl === "string" ? body.imageDataUrl : null;

  if (description.length < 10 && !imageDataUrl) {
    return NextResponse.json({ error: "Add a description or photo first" }, { status: 400 });
  }

  const result = (await callGroq(description, imageDataUrl)) ?? heuristicTriage(description || "civic issue");

  // Real, admin-configured department list — not a hardcoded map.
  const token = (await getToken({ template: "convex" })) ?? undefined;
  const department = await fetchQuery(api.departments.findByCategory, { category: result.category }, { token });

  return NextResponse.json({
    category: result.category,
    severity: result.severity,
    confidence: result.confidence,
    reasoning: result.reasoning,
    source: result.source,
    suggestedDepartment: department?.name ?? null,
  });
}
