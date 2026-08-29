"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";

import { Badge, Button, Card } from "@civicfix/ui-web";

import { LocationPicker, type PickedLocation } from "@/components/LocationPicker";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { CATEGORY_LABEL, SEVERITY_LABEL, STATUS_SHORT_LABEL } from "@/lib/status";
import type { IssueCategory, IssueSeverity, IssueStatus } from "@/lib/types";

import styles from "../resident.module.css";

interface AiSuggestion {
  category: IssueCategory;
  severity: IssueSeverity;
  confidence: number;
  reasoning: string;
  source: "vision" | "text" | "heuristic";
  suggestedDepartment: string | null;
}

interface SimilarIssue {
  id: string;
  tracking_id: string;
  description: string;
  status: IssueStatus;
  distance_m: number;
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
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

  const [similarIssues, setSimilarIssues] = useState<SimilarIssue[]>([]);

  const handleLocation = useCallback((next: PickedLocation) => setLocation(next), []);

  // Nearby-similar-report check: cheap (DB-only RPC), so it runs automatically
  // once a category and a pinned location both exist, debounced against
  // repeated map drags. Rendering is gated on category+location below, so a
  // stale list from a previous combination never has to be reset here.
  useEffect(() => {
    const client = supabase;
    if (!client || !category || !location) return;
    const timeout = setTimeout(async () => {
      const { data } = await client.rpc("find_nearby_similar_issues", {
        p_latitude: location.latitude,
        p_longitude: location.longitude,
        p_category: category,
        p_radius_m: 200,
      });
      setSimilarIssues((data as SimilarIssue[] | null) ?? []);
    }, 600);
    return () => clearTimeout(timeout);
  }, [category, location]);

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

  async function sha256Hex(file: File): Promise<string> {
    const buffer = await file.arrayBuffer();
    const digest = await crypto.subtle.digest("SHA-256", buffer);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (!category) return setError("Choose a category.");
    if (description.trim().length < 15)
      return setError("Describe the issue in at least 15 characters.");
    if (!location) return setError("Set the location on the map.");

    setError(null);
    setSubmitting(true);

    if (!supabase || !isSupabaseConfigured) {
      setError("Reporting isn't available in preview mode — Supabase isn't configured.");
      setSubmitting(false);
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("Your session expired — please sign in again.");
      setSubmitting(false);
      return;
    }

    let storageKey: string | null = null;
    let mimeType: string | null = null;
    let checksum: string | null = null;

    if (photoFile) {
      storageKey = `${user.id}/${Date.now()}-${photoFile.name}`;
      const { error: uploadError } = await supabase.storage
        .from("issue-media")
        .upload(storageKey, photoFile, { contentType: photoFile.type });
      if (uploadError) {
        setError(`Photo upload failed: ${uploadError.message}`);
        setSubmitting(false);
        return;
      }
      mimeType = photoFile.type;
      checksum = await sha256Hex(photoFile);
    }

    const { data: rpcData, error: rpcError } = await supabase
      .rpc("create_issue", {
        p_category: category,
        p_description: description.trim(),
        p_severity: severity,
        p_latitude: location.latitude,
        p_longitude: location.longitude,
        p_accuracy_m: null,
        p_neighborhood: landmark.trim() || null,
        p_storage_key: storageKey,
        p_mime_type: mimeType,
        p_checksum: checksum,
      })
      .single();

    const data = rpcData as { id: string; tracking_id: string } | null;

    if (rpcError || !data) {
      setError(rpcError?.message ?? "Could not submit the report. Please try again.");
      setSubmitting(false);
      return;
    }

    if (aiSuggestion) {
      await supabase.rpc("record_ai_assessment", {
        p_issue_id: data.id,
        p_category: aiSuggestion.category,
        p_severity: aiSuggestion.severity,
        p_confidence: aiSuggestion.confidence,
        p_reasoning: aiSuggestion.reasoning,
        p_provider: aiSuggestion.source === "heuristic" ? "heuristic" : "groq",
        p_model: aiSuggestion.source === "vision" ? "llama-4-scout-17b-16e-instruct" : "llama-3.1-8b-instant",
      });
    }

    const params = new URLSearchParams({
      trackingId: data.tracking_id,
      category,
      severity,
      lat: location.latitude.toFixed(5),
      lng: location.longitude.toFixed(5),
    });

    router.push(`/app/report/submitted?${params.toString()}`);
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
              {/* Local object URL preview; next/image is unnecessary here. */}
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
              nearby — consider confirming one of these instead of filing a new one.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
              {similarIssues.map((s) => (
                <Link
                  key={s.id}
                  href={`/issues/${s.id}`}
                  target="_blank"
                  className={styles.hint}
                  style={{ textDecoration: "underline" }}
                >
                  {s.tracking_id} · {STATUS_SHORT_LABEL[s.status]} · ~{Math.round(s.distance_m)}m away — {s.description.slice(0, 80)}
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
