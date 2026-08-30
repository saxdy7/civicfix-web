"use client";

import { useUser } from "@clerk/nextjs";
import { useConvex, useMutation } from "convex/react";
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
  const endorseIssue = useMutation(api.issues.endorse);
  const generateUploadUrl = useMutation(api.issueMedia.generateUploadUrl);
  const saveMedia = useMutation(api.issueMedia.save);
  const recordAssessment = useMutation(api.aiAssessments.record);
  const fileRef = useRef<HTMLInputElement>(null);

  const [category, setCategory] = useState<IssueCategory | null>(null);
  const [severity, setSeverity] = useState<IssueSeverity>("medium");
  const [isEmergency, setIsEmergency] = useState(false);
  const [description, setDescription] = useState("");
  const [landmark, setLandmark] = useState("");
  const [location, setLocation] = useState<PickedLocation | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoName, setPhotoName] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [isListening, setIsListening] = useState(false);
  const [endorsingId, setEndorsingId] = useState<string | null>(null);

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
    }, 500);
    return () => clearTimeout(timeout);
  }, [category, location, convex]);

  const toggleVoiceDictation = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const win = window as unknown as { SpeechRecognition?: any; webkitSpeechRecognition?: any };
    const SpeechRecognition = win.SpeechRecognition || win.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setError("Speech recognition is not supported in this browser. Please type your description.");
      return;
    }

    if (isListening) {
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = "en-US";

      recognition.onstart = () => {
        setIsListening(true);
        setError(null);
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onresult = (event: any) => {
        const transcript = event.results[0]?.[0]?.transcript;
        if (transcript) {
          setDescription((prev) => (prev ? `${prev.trim()} ${transcript}` : transcript));
        }
      };

      recognition.onerror = () => {
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
    } catch {
      setIsListening(false);
    }
  };

  const handleEndorseExisting = async (issueId: Doc<"issues">["_id"]) => {
    setEndorsingId(issueId);
    setError(null);
    try {
      await endorseIssue({ issueId, note: "Confirmed seeing this issue nearby." });
      router.push(`/issues/${issueId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not endorse this report.");
      setEndorsingId(null);
    }
  };

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
        severity: isEmergency ? "critical" : severity,
        isEmergency,
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
        id: issueId,
        trackingId,
        category,
        severity: isEmergency ? "critical" : severity,
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

        {/* Smart Pre-Submission Duplicate Radar */}
        {category && location && similarIssues.length > 0 ? (
          <Card tone="muted" style={{ marginTop: "var(--space-3)", border: "1px solid var(--color-civic-amber)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-2)", marginBottom: "var(--space-2)" }}>
              <span style={{ fontSize: "var(--font-size-sm)", fontWeight: 600, color: "var(--color-civic-amber)" }}>
                ⚠️ Nearby similar reports detected ({similarIssues.length})
              </span>
              <span style={{ fontSize: "var(--font-size-xs)", color: "var(--color-muted-foreground)" }}>
                Within 200m
              </span>
            </div>
            <p className={styles.hint} style={{ margin: "0 0 var(--space-3)" }}>
              Save city resources! If one of these reports describes your issue, confirm it with 1 click instead of creating a duplicate:
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
              {similarIssues.map((s) => (
                <div
                  key={s._id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "var(--space-3)",
                    padding: "var(--space-2) var(--space-3)",
                    background: "var(--color-surface)",
                    borderRadius: "var(--radius-control)",
                    border: "1px solid var(--color-border)",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                      <strong style={{ fontSize: "var(--font-size-sm)" }}>{s.trackingId}</strong>
                      <Badge tone={s.status === "resolved" ? "success" : "warning"}>
                        {STATUS_SHORT_LABEL[s.status]}
                      </Badge>
                      {s.endorsementCount && s.endorsementCount > 1 ? (
                        <span style={{ fontSize: "var(--font-size-xs)", color: "var(--color-muted-foreground)" }}>
                          👥 {s.endorsementCount} neighbors
                        </span>
                      ) : null}
                    </div>
                    <p style={{ margin: "var(--space-1) 0 0", fontSize: "var(--font-size-xs)", color: "var(--color-muted-foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {s.description}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => handleEndorseExisting(s._id)}
                    disabled={Boolean(endorsingId)}
                    style={{ whiteSpace: "nowrap" }}
                  >
                    {endorsingId === s._id ? "Confirming…" : "+1 I see this too"}
                  </Button>
                </div>
              ))}
            </div>
          </Card>
        ) : null}
      </div>

      {/* Emergency Mode / Hazard Escalation */}
      <div className={styles.field}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "var(--space-3) var(--space-4)",
            borderRadius: "var(--radius-control)",
            border: isEmergency ? "1px solid var(--color-civic-red)" : "1px solid var(--color-border)",
            background: isEmergency ? "rgba(225, 29, 72, 0.08)" : "var(--color-surface-muted)",
          }}
        >
          <div>
            <span style={{ fontWeight: 600, fontSize: "var(--font-size-sm)", color: isEmergency ? "var(--color-civic-red)" : "var(--color-foreground)" }}>
              🚨 Immediate Public Hazard / Danger
            </span>
            <p className={styles.hint} style={{ margin: "var(--space-1) 0 0" }}>
              For live wires, active gas leaks, collapsed roads, or immediate physical safety risks.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={isEmergency}
            onClick={() => {
              const next = !isEmergency;
              setIsEmergency(next);
              if (next) setSeverity("critical");
            }}
            style={{
              padding: "var(--space-2) var(--space-3)",
              borderRadius: "var(--radius-pill)",
              border: "1px solid var(--color-border)",
              background: isEmergency ? "var(--color-civic-red)" : "var(--color-surface)",
              color: isEmergency ? "#fff" : "var(--color-foreground)",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: "var(--font-size-xs)",
              whiteSpace: "nowrap",
            }}
          >
            {isEmergency ? "Hazard Active (4h SLA)" : "Flag as Emergency"}
          </button>
        </div>
      </div>

      {/* Severity */}
      {!isEmergency ? (
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
      ) : null}

      {/* Description with Voice Dictation */}
      <div className={styles.field}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-2)" }}>
          <label className={styles.label} htmlFor="description" style={{ margin: 0 }}>
            5. Describe the issue
          </label>
          <button
            type="button"
            onClick={toggleVoiceDictation}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "var(--space-1)",
              padding: "var(--space-1) var(--space-3)",
              borderRadius: "var(--radius-pill)",
              border: isListening ? "1px solid var(--color-civic-red)" : "1px solid var(--color-border)",
              background: isListening ? "rgba(225, 29, 72, 0.15)" : "var(--color-surface-muted)",
              color: isListening ? "var(--color-civic-red)" : "var(--color-foreground)",
              fontSize: "var(--font-size-xs)",
              cursor: "pointer",
              fontWeight: 500,
            }}
            aria-label="Voice Dictation"
          >
            <span>{isListening ? "🔴 Listening…" : "🎙️ Voice dictation"}</span>
          </button>
        </div>
        <textarea
          id="description"
          className={styles.textarea}
          placeholder="What is wrong, how long has it been like this, and who does it affect? (Or click Voice dictation to speak)"
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
          {submitting ? "Submitting…" : isEmergency ? "🚨 Submit Emergency Report" : "Submit report"}
        </Button>
        <Button type="button" variant="secondary" onClick={() => router.push("/app")}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
