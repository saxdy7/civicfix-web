"use client";

import { useMutation } from "convex/react";
import { useState, type ChangeEvent } from "react";

import { Button } from "@civicfix/ui-web";

import { api } from "@convex/_generated/api";
import type { Doc, Id } from "@convex/_generated/dataModel";

const DEFAULT_SAMPLE_PHOTOS = [
  {
    name: "Road / Pothole Repair",
    beforeUrl: "https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?auto=format&fit=crop&w=800&q=80",
    afterUrl: "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=800&q=80",
  },
  {
    name: "Streetlight / Electrical Fix",
    beforeUrl: "https://images.unsplash.com/photo-1509114397022-ed747cca3f65?auto=format&fit=crop&w=800&q=80",
    afterUrl: "https://images.unsplash.com/photo-1513836279014-a89f7a76ae86?auto=format&fit=crop&w=800&q=80",
  },
  {
    name: "Garbage & Waste Cleaned",
    beforeUrl: "https://images.unsplash.com/photo-1530587191325-3db32d826c18?auto=format&fit=crop&w=800&q=80",
    afterUrl: "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&w=800&q=80",
  },
];

export function CompleteTaskModal({
  issue,
  assignmentId,
  onClose,
}: {
  issue: Doc<"issues">;
  assignmentId?: Id<"assignments">;
  onClose: () => void;
}) {
  const generateUploadUrl = useMutation(api.issueMedia.generateUploadUrl);
  const saveMedia = useMutation(api.issueMedia.save);
  const submitEvidence = useMutation(api.resolutionEvidence.submit);

  const [beforeFile, setBeforeFile] = useState<File | null>(null);
  const [afterFile, setAfterFile] = useState<File | null>(null);
  const [sampleIndex, setSampleIndex] = useState<number>(0);
  const [useUploads, setUseUploads] = useState<boolean>(false);
  const [note, setNote] = useState<string>("Issue fixed completely according to city safety guidelines.");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uploadFileToConvex = async (file: File): Promise<Id<"issueMedia">> => {
    const postUrl = await generateUploadUrl();
    const result = await fetch(postUrl, {
      method: "POST",
      headers: { "Content-Type": file.type },
      body: file,
    });

    if (!result.ok) {
      throw new Error(`Upload failed: ${result.statusText}`);
    }

    const { storageId } = (await result.json()) as { storageId: Id<"_storage"> };
    const mediaId = await saveMedia({
      issueId: issue._id,
      storageId,
      mimeType: file.type.includes("png") ? "image/png" : "image/jpeg",
      checksum: `${file.name}-${file.size}-${Date.now()}`,
      sizeBytes: file.size,
    });
    return mediaId;
  };

  const uploadBlobFromUrl = async (url: string, prefix: string): Promise<Id<"issueMedia">> => {
    const resp = await fetch(url);
    const blob = await resp.blob();
    const file = new File([blob], `${prefix}-${Date.now()}.jpg`, { type: "image/jpeg" });
    return await uploadFileToConvex(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      let beforeId: Id<"issueMedia">;
      let afterId: Id<"issueMedia">;

      if (useUploads) {
        if (!beforeFile || !afterFile) {
          throw new Error("Please select both Before and After work photos.");
        }
        beforeId = await uploadFileToConvex(beforeFile);
        afterId = await uploadFileToConvex(afterFile);
      } else {
        const sample = DEFAULT_SAMPLE_PHOTOS[sampleIndex] ?? DEFAULT_SAMPLE_PHOTOS[0];
        beforeId = await uploadBlobFromUrl(sample.beforeUrl, "before");
        afterId = await uploadBlobFromUrl(sample.afterUrl, "after");
      }

      await submitEvidence({
        issueId: issue._id,
        assignmentId,
        beforeMediaId: beforeId,
        afterMediaId: afterId,
        note: note.trim() || "Work completed successfully.",
      });

      onClose();
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to submit evidence.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.6)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: "var(--space-4)",
      }}
    >
      <div
        style={{
          background: "var(--color-surface, #ffffff)",
          border: "1px solid var(--color-border, #e2e8f0)",
          borderRadius: "var(--radius-lg, 12px)",
          maxWidth: "540px",
          width: "100%",
          padding: "var(--space-5)",
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
          color: "var(--color-foreground, #0f172a)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-4)" }}>
          <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700, color: "var(--color-foreground, #0f172a)" }}>
            📸 Complete Task & Submit Evidence
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            style={{
              background: "none",
              border: "none",
              color: "var(--color-muted-foreground, #64748b)",
              fontSize: "1.25rem",
              cursor: "pointer",
              padding: "4px",
            }}
          >
            ✕
          </button>
        </div>

        <p style={{ margin: "0 0 16px", fontSize: "0.875rem", color: "var(--color-muted-foreground, #475569)", lineHeight: 1.5 }}>
          Submit Before and After work photos for <strong style={{ color: "var(--color-foreground, #0f172a)" }}>{issue.trackingId}</strong> ({issue.category}). Once submitted, this report moves to <strong>Community Verification</strong> for citizens to inspect and vote!
        </p>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={{ display: "flex", gap: "12px", borderBottom: "1px solid var(--color-border, #e2e8f0)", paddingBottom: "12px" }}>
            <button
              type="button"
              onClick={() => setUseUploads(false)}
              style={{
                flex: 1,
                padding: "8px 12px",
                borderRadius: "6px",
                border: "1px solid " + (!useUploads ? "var(--color-civic-green, #10b981)" : "var(--color-border, #cbd5e1)"),
                background: !useUploads ? "rgba(16, 185, 129, 0.15)" : "var(--color-surface, #ffffff)",
                color: !useUploads ? "#059669" : "var(--color-muted-foreground, #64748b)",
                fontWeight: 700,
                cursor: "pointer",
                fontSize: "0.85rem",
              }}
            >
              ⚡ Quick Sample Photos
            </button>
            <button
              type="button"
              onClick={() => setUseUploads(true)}
              style={{
                flex: 1,
                padding: "8px 12px",
                borderRadius: "6px",
                border: "1px solid " + (useUploads ? "var(--color-civic-green, #10b981)" : "var(--color-border, #cbd5e1)"),
                background: useUploads ? "rgba(16, 185, 129, 0.15)" : "var(--color-surface, #ffffff)",
                color: useUploads ? "#059669" : "var(--color-muted-foreground, #64748b)",
                fontWeight: 700,
                cursor: "pointer",
                fontSize: "0.85rem",
              }}
            >
              📁 Custom Upload
            </button>
          </div>

          {!useUploads ? (
            <div>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 700, marginBottom: "8px", color: "var(--color-foreground, #0f172a)" }}>
                Select Field Preset Photos:
              </label>
              <select
                value={sampleIndex}
                onChange={(e) => setSampleIndex(Number(e.target.value))}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: "8px",
                  background: "var(--color-surface, #ffffff)",
                  border: "1px solid var(--color-border, #cbd5e1)",
                  color: "var(--color-foreground, #0f172a)",
                  fontSize: "0.9rem",
                  fontWeight: 500,
                  outline: "none",
                }}
              >
                {DEFAULT_SAMPLE_PHOTOS.map((p, idx) => (
                  <option key={p.name} value={idx} style={{ background: "var(--color-surface, #ffffff)", color: "#0f172a" }}>
                    {p.name}
                  </option>
                ))}
              </select>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginTop: "12px" }}>
                <div>
                  <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--color-muted-foreground, #64748b)", display: "block", marginBottom: "4px" }}>
                    BEFORE WORK:
                  </span>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={DEFAULT_SAMPLE_PHOTOS[sampleIndex].beforeUrl}
                    alt="Before"
                    style={{ width: "100%", height: "110px", objectFit: "cover", borderRadius: "6px", border: "1px solid var(--color-border, #cbd5e1)" }}
                  />
                </div>
                <div>
                  <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--color-muted-foreground, #64748b)", display: "block", marginBottom: "4px" }}>
                    AFTER WORK (FIXED):
                  </span>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={DEFAULT_SAMPLE_PHOTOS[sampleIndex].afterUrl}
                    alt="After"
                    style={{ width: "100%", height: "110px", objectFit: "cover", borderRadius: "6px", border: "1px solid var(--color-border, #cbd5e1)" }}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 700, marginBottom: "6px", color: "var(--color-foreground, #0f172a)" }}>
                  Before Photo:
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setBeforeFile(e.target.files?.[0] ?? null)}
                  style={{ fontSize: "0.8rem", color: "var(--color-foreground, #0f172a)" }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 700, marginBottom: "6px", color: "var(--color-foreground, #0f172a)" }}>
                  After Photo:
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setAfterFile(e.target.files?.[0] ?? null)}
                  style={{ fontSize: "0.8rem", color: "var(--color-foreground, #0f172a)" }}
                />
              </div>
            </div>
          )}

          <div>
            <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 700, marginBottom: "6px", color: "var(--color-foreground, #0f172a)" }}>
              Worker Field Note:
            </label>
            <textarea
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Describe work completed (materials used, safety checks done...)"
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: "8px",
                background: "var(--color-surface, #ffffff)",
                border: "1px solid var(--color-border, #cbd5e1)",
                color: "var(--color-foreground, #0f172a)",
                fontSize: "0.875rem",
                resize: "vertical",
                boxSizing: "border-box",
                outline: "none",
              }}
            />
          </div>

          {error ? (
            <div style={{ color: "#ef4444", fontSize: "0.85rem", background: "rgba(239, 68, 68, 0.1)", padding: "8px 12px", borderRadius: "6px" }}>
              {error}
            </div>
          ) : null}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "8px" }}>
            <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Uploading & Submitting…" : "✓ Submit Completion Evidence"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
