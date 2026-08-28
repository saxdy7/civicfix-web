"use client";

import { useRouter } from "next/navigation";
import { useCallback, useRef, useState, type FormEvent } from "react";

import { Button, Card } from "@civicfix/ui-web";

import { LocationPicker, type PickedLocation } from "@/components/LocationPicker";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { CATEGORY_LABEL } from "@/lib/status";
import type { IssueCategory, IssueSeverity } from "@/lib/types";

import styles from "../resident.module.css";

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

  const handleLocation = useCallback((next: PickedLocation) => setLocation(next), []);

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
