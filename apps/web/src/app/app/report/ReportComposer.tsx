"use client";

import { useUser } from "@clerk/nextjs";
import { useConvex, useMutation } from "convex/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";

import { Badge, Button, Card } from "@civicfix/ui-web";

import { LocationPicker, type PickedLocation } from "@/components/LocationPicker";
import { CATEGORY_LABEL, SEVERITY_LABEL, STATUS_SHORT_LABEL } from "@/lib/status";
import type { IssueCategory, IssueSeverity } from "@/lib/types";

import { api } from "@convex/_generated/api";
import type { Doc } from "@convex/_generated/dataModel";

import styles from "../resident.module.css";

interface AiSuggestion {
  category: IssueCategory;
  severity: IssueSeverity;
  confidence: number;
  reasoning: string;
  source: "vision" | "text" | "heuristic";
  suggestedDepartment: string | null;
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function sha256Hex(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const CATEGORIES: { key: IssueCategory; glyph: string }[] = [
  { key: "pothole", glyph: "P" },
  { key: "garbage", glyph: "G" },
  { key: "streetlight", glyph: "S" },
  { key: "other", glyph: "+" },
];

const SEVERITIES: { key: IssueSeverity; label: string }[] = [
  { key: "low", label: "Low — cosmetic" },
  { key: "medium", label: "Medium — needs attention" },
  { key: "high", label: "High — unsafe" },
  { key: "critical", label: "Critical — immediate danger" },
];

export function ReportComposer() {
  const router = useRouter();
  const { user } = useUser();
  const convex = useConvex();
  const createIssue = useMutation(api.issues.create);
  const generateUploadUrl = useMutation(api.issueMedia.generateUploadUrl);
  const saveMedia = useMutation(api.issueMedia.save);
  const recordAssessment = useMutation(api.aiAssessments.record);
  const fileRef = useRef<HTMLInputElement>(null);

  const [category, setCategory] = useState<IssueCategory | null>(null);
  const [severity, setSeverity] = useState<IssueSeverity>("medium");
  const [description, setDescription] = useState("");
  const [landmark, setLandmark] = useState("");
  const [location, setLocation] = useState<PickedLocation | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoName, setPhotoName] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [aiSuggestion, setAiSuggestion] = useState<AiSuggestion | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiUsed, setAiUsed] = useState(false);

  const [similarIssues, setSimilarIssues] = useState<Doc<"issues">[]>([]);

  const handleLocation = useCallback((next: PickedLocation) => setLocation(next), []);

  useEffect(() => {
    if (!category || !location) return;
    const timeout = setTimeout(async () => {
      const results = await convex.query(api.issues.findNearbySimilar, {
        latitude: location.latitude,
        longitude: location.longitude,
        category,
        radiusM: 200,
      });
      setSimilarIssues(results);
    }, 600);
    return () => clearTimeout(timeout);
  }, [category, location, convex]);

  const handleAnalyzeWithAi = async () => {
    if (!description.trim() && !photoFile) {
      setAiError("Add a description or photo first.");
      return;
    }
    setAiLoading(true);
    setAiError(null);
    try {
      const imageDataUrl = photoFile ? await fileToDataUrl(photoFile) : null;
      const res = await fetch("/api/ai-triage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: description.trim(), imageDataUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "AI analysis failed");
      setAiSuggestion(data as AiSuggestion);
      setAiUsed(false);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "Could not analyze this report right now.");
    } finally {
      setAiLoading(false);
    }
  };

  const handleUseAiSuggestion = () => {
    if (!aiSuggestion) return;
    setCategory(aiSuggestion.category);
    setSeverity(aiSuggestion.severity);
    setAiUsed(true);
  };

  const handlePhoto = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("Photo must be under 10 MB.");
      return;
    }
    setError(null);
    setPhotoName(file.name);
    setPhotoFile(file);
    setPhotoUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (!category) return setError("Choose a category.");
    if (description.trim().length < 15) return setError("Describe the issue in at least 15 characters.");
    if (!location) return setError("Set the location on the map.");
    if (!user) return setError("Your session expired — please sign in again.");

    setError(null);
    setSubmitting(true);

    try {
      const { id: issueId, trackingId } = await createIssue({
        category,
        description: description.trim(),
        severity,
        latitude: location.latitude,
        longitude: location.longitude,
        neighborhood: landmark.trim() || undefined,
      });

      if (photoFile) {
        const uploadUrl = await generateUploadUrl();
        const uploadRes = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": photoFile.type },
          body: photoFile,
        });
        const { storageId } = await uploadRes.json();
        const checksum = await sha256Hex(photoFile);
        await saveMedia({ issueId, storageId, mimeType: photoFile.type, checksum, sizeBytes: photoFile.size });
      }

      if (aiSuggestion) {
        await recordAssessment({
          issueId,
          category: aiSuggestion.category,
          severity: aiSuggestion.severity,
          confidence: aiSuggestion.confidence,
          reasoning: aiSuggestion.reasoning,
          provider: aiSuggestion.source === "heuristic" ? "heuristic" : "groq",
          model: aiSuggestion.source === "vision" ? "llama-4-scout-17b-16e-instruct" : "llama-3.1-8b-instant",
        });
      }

      const params = new URLSearchParams({
        trackingId,
        category,
        severity,
        lat: location.latitude.toFixed(5),
        lng: location.longitude.toFixed(5),
      });
      router.push(`/app/report/submitted?${params.toString()}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit the report. Please try again.");
      setSubmitting(false);
    }
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      {/* Category */}
      <div className={styles.field}>
        <span className={styles.label}>1. What kind of issue is it?</span>
        <div className={styles.categoryGrid}>
          {CATEGORIES.map((c) => (
            <button
              key={c.key}
              type="button"
              className={`${styles.categoryOption} ${category === c.key ? styles.categoryOptionActive : ""}`}
              onClick={() => setCategory(c.key)}
              aria-pressed={category === c.key}
            >
              <span className={styles.categoryGlyph}>{c.glyph}</span>
              <span className={styles.categoryName}>{CATEGORY_LABEL[c.key]}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Photo */}
      <div className={styles.field}>
        <span className={styles.label}>2. Add a photo</span>
        <p className={styles.hint}>
          Strongly recommended — a photo drives AI-assisted triage and speeds up routing. Location
          metadata is stripped before anything is shown publicly.
        </p>
        <div className={styles.photoDrop}>
          {photoUrl ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photoUrl} alt="Selected issue photo" className={styles.photoPreview} />
              <p className={styles.hint}>{photoName}</p>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  if (photoUrl) URL.revokeObjectURL(photoUrl);
                  setPhotoUrl(null);
                  setPhotoName(null);
                  if (fileRef.current) fileRef.current.value = "";
                }}
              >
                Remove photo
              </Button>
            </>
          ) : (
            <>
              <p className={styles.hint}>PNG or JPG, up to 10 MB.</p>
              <Button type="button" variant="secondary" onClick={() => fileRef.current?.click()}>
                Choose a photo
              </Button>
            </>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={handlePhoto}
            aria-label="Issue photo"
          />
        </div>

        <Card tone="muted" style={{ marginTop: "var(--space-3)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-3)" }}>
            <p className={styles.hint} style={{ margin: 0 }}>
              🤖 Let AI suggest the category and severity from your description{photoFile ? " and photo" : ""}.
            </p>
            <Button type="button" variant="secondary" onClick={handleAnalyzeWithAi} disabled={aiLoading}>
              {aiLoading ? "Analyzing…" : "Analyze with AI"}
            </Button>
          </div>
          {aiError ? (
            <p className={styles.errorText} role="alert" style={{ marginTop: "var(--space-2)" }}>
              {aiError}
            </p>
          ) : null}
          {aiSuggestion ? (
            <div style={{ marginTop: "var(--space-3)", display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
              <p style={{ margin: 0 }}>
                Looks like <strong>{CATEGORY_LABEL[aiSuggestion.category]}</strong>,{" "}
                <strong>{SEVERITY_LABEL[aiSuggestion.severity]}</strong> severity{" "}
                <Badge tone="info">{Math.round(aiSuggestion.confidence * 100)}% confidence</Badge>
              </p>
              <p className={styles.hint} style={{ margin: 0 }}>
                {aiSuggestion.reasoning}
                {aiSuggestion.suggestedDepartment ? ` Likely department: ${aiSuggestion.suggestedDepartment}.` : ""}
              </p>
              <div>
                <Button type="button" variant="secondary" onClick={handleUseAiSuggestion} disabled={aiUsed}>
                  {aiUsed ? "Applied" : "Use this suggestion"}
                </Button>
              </div>
            </div>
          ) : null}
        </Card>
      </div>

      {/* Location */}
      <div className={styles.field}>
        <span className={styles.label}>3. Where is it?</span>
        <p className={styles.hint}>
          Drag the map so the pin sits on the issue, or use your current location.
        </p>
        <LocationPicker value={location} onChange={handleLocation} />
        <input
          className={styles.input}
          placeholder="Nearest landmark or cross street (optional)"
          value={landmark}
          onChange={(e) => setLandmark(e.target.value)}
          aria-label="Nearest landmark"
        />
        {category && location && similarIssues.length > 0 ? (
          <Card tone="muted" style={{ marginTop: "var(--space-3)" }}>
            <p className={styles.hint} style={{ margin: "0 0 var(--space-2)" }}>
              {similarIssues.length === 1 ? "A similar report already exists" : "Similar reports already exist"}{" "}
              nearby — take a look before filing a new one.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
              {similarIssues.map((s) => (
                <Link
                  key={s._id}
                  href={`/issues/${s._id}`}
                  target="_blank"
                  className={styles.hint}
                  style={{ textDecoration: "underline" }}
                >
                  {s.trackingId} · {STATUS_SHORT_LABEL[s.status]} — {s.description.slice(0, 80)}
                  {s.description.length > 80 ? "…" : ""}
                </Link>
              ))}
            </div>
          </Card>
        ) : null}
      </div>

      {/* Severity */}
      <div className={styles.field}>
        <span className={styles.label}>4. How urgent is it?</span>
        <p className={styles.hint}>
          Your assessment is a signal, not the final call — staff confirm severity during triage.
        </p>
        <div className={styles.severityRow}>
          {SEVERITIES.map((s) => (
            <button
              key={s.key}
              type="button"
              className={`${styles.severityChip} ${severity === s.key ? styles.severityChipActive : ""}`}
              onClick={() => setSeverity(s.key)}
              aria-pressed={severity === s.key}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Description */}
      <div className={styles.field}>
        <label className={styles.label} htmlFor="description">
          5. Describe the issue
        </label>
        <textarea
          id="description"
          className={styles.textarea}
          placeholder="What is wrong, how long has it been like this, and who does it affect?"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <p className={styles.hint}>{description.trim().length} characters — minimum 15.</p>
      </div>

      <Card className={styles.privacyNote}>
        <strong>Before you submit.</strong> Your exact coordinates and contact details are visible
        only to authorised staff — the public map shows a generalised location. EXIF metadata is
        stripped from your photo. Every staff member who opens your report is recorded in an
        append-only audit log.
      </Card>

      {error ? (
        <p className={styles.errorText} role="alert">
          {error}
        </p>
      ) : null}

      <div className={styles.actions}>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Submitting…" : "Submit report"}
        </Button>
        <Button type="button" variant="secondary" onClick={() => router.push("/app")}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
