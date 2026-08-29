import type { BotMessage } from "./types";
import { MOCK_ISSUES } from "@/lib/mock-data";
import type { IssueCategory, IssueSeverity } from "@/lib/types";

// Keyword classifier for civic reporting
const CATEGORY_KEYWORDS: Record<IssueCategory, string[]> = {
  pothole: ["pothole", "crater", "road", "asphalt", "bump", "pavement", "crack", "sinkhole", "tarmac"],
  garbage: ["garbage", "trash", "dump", "litter", "waste", "dumpster", "overflow", "rubbish", "debris", "bin"],
  streetlight: ["streetlight", "light", "lamp", "dark", "pole", "bulb", "flicker", "blackout", "illumination"],
  other: ["water", "leak", "pipe", "tree", "branch", "sidewalk", "graffiti", "drain", "traffic", "sign", "manhole"],
};

const SEVERITY_KEYWORDS: Record<IssueSeverity, string[]> = {
  critical: ["danger", "hazard", "immediate", "emergency", "fatal", "sinkhole", "severe accident", "sparking"],
  high: ["dangerous", "high", "urgent", "deep", "large", "traffic blocked", "swerving", "major"],
  medium: ["medium", "moderate", "broken", "overflowing", "annoying", "bad"],
  low: ["minor", "cosmetic", "small", "faint", "slight"],
};

export function parseCivicIntent(input: string): {
  intent: "report" | "status" | "faq" | "greeting" | "help";
  category?: IssueCategory;
  severity?: IssueSeverity;
  trackingId?: string;
  extractedLocation?: string;
} {
  const lower = input.toLowerCase().trim();

  // Check for tracking ID pattern (e.g. CF-10234 or CF-XXXXX or 10234)
  const trackingMatch = input.match(/CF-\d{4,6}/i) || input.match(/#(\d{4,6})/);
  if (trackingMatch || lower.includes("status") || lower.includes("track") || lower.includes("where is my")) {
    const id = trackingMatch ? (trackingMatch[0].startsWith("#") ? `CF-${trackingMatch[1]}` : trackingMatch[0].toUpperCase()) : undefined;
    return { intent: "status", trackingId: id };
  }

  // Greetings
  if (["hi", "hello", "hey", "good morning", "good evening", "start"].some((g) => lower === g || lower.startsWith(`${g} `))) {
    return { intent: "greeting" };
  }

  // FAQs
  if (
    lower.includes("how does this work") ||
    lower.includes("what is civicfix") ||
    lower.includes("emergency") ||
    lower.includes("sla") ||
    lower.includes("timing") ||
    lower.includes("hours")
  ) {
    return { intent: "faq" };
  }

  // Classify category
  let category: IssueCategory = "other";
  for (const [cat, words] of Object.entries(CATEGORY_KEYWORDS)) {
    if (words.some((w) => lower.includes(w))) {
      category = cat as IssueCategory;
      break;
    }
  }

  // Classify severity
  let severity: IssueSeverity = "medium";
  for (const [sev, words] of Object.entries(SEVERITY_KEYWORDS)) {
    if (words.some((w) => lower.includes(w))) {
      severity = sev as IssueSeverity;
      break;
    }
  }

  // Extract location cues (near X, at Y, on Z)
  const locMatch = input.match(/(?:at|near|on|in|around)\s+([A-Za-z0-9\s,&'-]+?)(?:\.|$|,|\band\b)/i);
  const extractedLocation = locMatch ? locMatch[1].trim() : undefined;

  return {
    intent: "report",
    category,
    severity,
    extractedLocation,
  };
}

export function generateBotResponse(
  userText: string,
  attachedPhotoUrl?: string,
): BotMessage {
  const analysis = parseCivicIntent(userText);
  const now = new Date().toISOString();
  const id = `msg-${Date.now()}`;

  if (analysis.intent === "greeting") {
    return {
      id,
      sender: "bot",
      text: "Hello! I am **CivicBot**, your automated civic resolution assistant. 🏙️\n\nI can help you:\n• **Report an issue** in natural language or with a photo\n• **Track status** of existing reports (#CF-XXXXX)\n• **Detect duplicates** & connect with city departments\n\nHow can I help you today?",
      createdAt: now,
      actions: [
        { label: "🕳️ Report a Pothole", actionId: "prompt_pothole" },
        { label: "🗑️ Report Garbage Overflow", actionId: "prompt_garbage" },
        { label: "💡 Report Streetlight Failure", actionId: "prompt_streetlight" },
        { label: "🔍 Track My Report", actionId: "prompt_track" },
      ],
    };
  }

  if (analysis.intent === "faq") {
    return {
      id,
      sender: "bot",
      text: "ℹ️ **CivicFix System Overview**\n\n• **Resolution Cycle:** Report → AI Triage → Field Assignment → Evidence Verification → Public Resolution.\n• **SLAs:** Critical safety issues (48h), Standard road/sanitation (5 business days).\n• **Privacy:** Your exact residential coordinates are generalized on public maps to protect your privacy.",
      createdAt: now,
      actions: [
        { label: "Report New Issue", actionId: "start_report" },
        { label: "View Live City Map", actionId: "open_map" },
      ],
    };
  }

  if (analysis.intent === "status") {
    if (analysis.trackingId) {
      const match = MOCK_ISSUES.find(
        (iss) => iss.trackingId.toUpperCase() === analysis.trackingId?.toUpperCase(),
      );
      if (match) {
        return {
          id,
          sender: "bot",
          text: `Found report **${match.trackingId}**! Here is the latest live status:`,
          createdAt: now,
          type: "status_card",
          data: {
            statusResult: {
              trackingId: match.trackingId,
              category: match.category,
              status: match.status,
              severity: match.severity,
              neighborhood: match.neighborhood,
              createdAt: match.createdAt,
              updatedAt: match.updatedAt,
              department: match.department,
              timeline: (match.events || []).map((e) => ({
                status: e.status,
                note: e.note,
                time: e.createdAt,
              })),
            },
          },
          actions: [
            { label: "View Public Details", actionId: "view_issue", payload: { id: match.id } },
            { label: "Check Another Issue", actionId: "prompt_track" },
          ],
        };
      } else {
        return {
          id,
          sender: "bot",
          text: `Could not find a ticket matching **${analysis.trackingId}**. Please double-check your tracking ID (e.g., \`CF-10234\`) or check your recent reports.`,
          createdAt: now,
          actions: [
            { label: "Try CF-10234 (Sample)", actionId: "track_sample", payload: { id: "CF-10234" } },
            { label: "Try CF-10198 (Sample)", actionId: "track_sample", payload: { id: "CF-10198" } },
          ],
        };
      }
    } else {
      return {
        id,
        sender: "bot",
        text: "Please provide your Tracking ID (for example: **CF-10234**) so I can fetch its live status and field evidence.",
        createdAt: now,
        actions: [
          { label: "Check CF-10234 (Pothole)", actionId: "track_sample", payload: { id: "CF-10234" } },
          { label: "Check CF-10198 (Garbage)", actionId: "track_sample", payload: { id: "CF-10198" } },
        ],
      };
    }
  }

  // Report creation flow
  const cat = analysis.category || "other";
  const sev = analysis.severity || "medium";
  const neighborhood = analysis.extractedLocation || "Civic District (Detected)";
  const lat = 37.7749 + (Math.random() - 0.5) * 0.02;
  const lng = -122.4194 + (Math.random() - 0.5) * 0.02;

  // Check duplicate simulation
  const duplicates = MOCK_ISSUES.filter((i) => i.category === cat).slice(0, 1).map((i) => ({
    id: i.id,
    trackingId: i.trackingId,
    category: i.category,
    distanceMeters: 45,
    neighborhood: i.neighborhood,
  }));

  return {
    id,
    sender: "bot",
    text: `I've analyzed your description and prepared an automated report draft:`,
    createdAt: now,
    type: "report_draft",
    data: {
      draft: {
        category: cat,
        severity: sev,
        description: userText,
        neighborhood,
        latitude: lat,
        longitude: lng,
        photoUrl: attachedPhotoUrl,
      },
      duplicates: duplicates.length > 0 ? duplicates : undefined,
    },
    actions: [
      { label: "✅ Confirm & Submit Ticket", actionId: "submit_report", variant: "primary" },
      { label: "✏️ Modify Details", actionId: "edit_report", variant: "secondary" },
    ],
  };
}
