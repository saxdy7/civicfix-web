"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Badge, Button, Card } from "@civicfix/ui-web";

import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { IssueStatus } from "@/lib/types";

import styles from "../../admin.module.css";

export interface EvidenceRecord {
  id: string;
  beforeUrl: string | null;
  afterUrl: string | null;
  note: string | null;
  submittedAt: string;
  verifiedAt: string | null;
}

async function sha256Hex(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function EvidencePanel({
  issueId,
  issueStatus,
  assignmentId,
  currentUserId,
  evidence,
}: {
  issueId: string;
  issueStatus: IssueStatus;
  assignmentId: string | null;
  currentUserId: string;
  evidence: EvidenceRecord | null;
}) {
  const router = useRouter();
  const beforeRef = useRef<HTMLInputElement>(null);
  const afterRef = useRef<HTMLInputElement>(null);

  const [beforeFile, setBeforeFile] = useState<File | null>(null);
  const [afterFile, setAfterFile] = useState<File | null>(null);
  const [note, setNote] = useState("");
  const [uploading, setUploading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const closed: IssueStatus[] = ["resolved", "rejected", "duplicate"];
  // After a reopen, a fresh round of evidence can always be submitted even
  // if an earlier (now-superseded) round exists.
  const canUpload = !closed.includes(issueStatus) && (!evidence || issueStatus === "reopened");

  async function uploadOne(file: File, label: "before" | "after") {
    if (!supabase) throw new Error("Not configured");
    const storageKey = `${currentUserId}/evidence-${Date.now()}-${label}-${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from("issue-media")
      .upload(storageKey, file, { contentType: file.type });
    if (uploadError) throw new Error(`${label === "before" ? "Before" : "After"} photo: ${uploadError.message}`);

    const checksum = await sha256Hex(file);
    const { data, error: mediaError } = await supabase
      .from("issue_media")
      .insert({ issue_id: issueId, storage_key: storageKey, mime_type: file.type, checksum })
      .select("id")
      .single();
    if (mediaError || !data) throw new Error(mediaError?.message ?? `Could not save the ${label} photo.`);
    return data.id as string;
  }

  async function handleSubmit() {
    if (!supabase || !beforeFile || !afterFile) {
      setError("Choose both a before and an after photo.");
      return;
    }
    setUploading(true);
    setError(null);
    setMessage(null);
    try {
      const [beforeMediaId, afterMediaId] = await Promise.all([
        uploadOne(beforeFile, "before"),
        uploadOne(afterFile, "after"),
      ]);

      const { error: evidenceError } = await supabase.from("resolution_evidence").insert({
        issue_id: issueId,
        assignment_id: assignmentId,
        before_media_id: beforeMediaId,
        after_media_id: afterMediaId,
        note: note.trim() || null,
        submitted_by: currentUserId,
      });
      if (evidenceError) throw new Error(evidenceError.message);

      if (issueStatus === "in_progress") {
        const { error: statusError } = await supabase.rpc("update_issue_status", {
          p_issue_id: issueId,
          p_next_status: "pending_verification",
        });
        if (statusError) throw new Error(statusError.message);
        setMessage("Evidence recorded and status moved to Pending verification.");
      } else {
        setMessage(
          "Evidence recorded. Move this issue to In Progress, then Pending Verification, before it can be resolved.",
        );
      }

      setBeforeFile(null);
      setAfterFile(null);
      if (beforeRef.current) beforeRef.current.value = "";
      if (afterRef.current) afterRef.current.value = "";
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit evidence.");
    } finally {
      setUploading(false);
    }
  }

  async function handleVerify() {
    if (!supabase || !evidence) return;
    setVerifying(true);
    setError(null);
    try {
      const { error: verifyError } = await supabase.rpc("verify_resolution_evidence", {
        p_evidence_id: evidence.id,
      });
      if (verifyError) throw new Error(verifyError.message);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not verify this evidence.");
    } finally {
      setVerifying(false);
    }
  }

  return (
    <Card>
      <h2 className={styles.sectionTitle}>Before / after evidence</h2>

      {evidence ? (
        <div style={{ marginBottom: canUpload ? "var(--space-5)" : 0 }}>
          <div style={{ display: "flex", gap: "var(--space-4)", flexWrap: "wrap", marginBottom: "var(--space-3)" }}>
            <div style={{ flex: 1, minWidth: 160 }}>
              <p style={{ fontSize: "var(--font-size-xs)", color: "var(--color-muted-foreground)", marginBottom: "var(--space-1)" }}>
                Before
              </p>
              {evidence.beforeUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={evidence.beforeUrl}
                  alt="Before"
                  style={{ width: "100%", borderRadius: "var(--radius-control)", display: "block" }}
                />
              ) : (
                <p style={{ fontSize: "var(--font-size-sm)", color: "var(--color-muted-foreground)" }}>No photo</p>
              )}
            </div>
            <div style={{ flex: 1, minWidth: 160 }}>
              <p style={{ fontSize: "var(--font-size-xs)", color: "var(--color-muted-foreground)", marginBottom: "var(--space-1)" }}>
                After
              </p>
              {evidence.afterUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={evidence.afterUrl}
                  alt="After"
                  style={{ width: "100%", borderRadius: "var(--radius-control)", display: "block" }}
                />
              ) : (
                <p style={{ fontSize: "var(--font-size-sm)", color: "var(--color-muted-foreground)" }}>No photo</p>
              )}
            </div>
          </div>

          {evidence.note ? (
            <p style={{ margin: "0 0 var(--space-3)", fontSize: "var(--font-size-sm)" }}>{evidence.note}</p>
          ) : null}

          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", flexWrap: "wrap" }}>
            <Badge tone={evidence.verifiedAt ? "success" : "warning"}>
              {evidence.verifiedAt ? "Verified" : "Awaiting verification"}
            </Badge>
            <span style={{ fontSize: "var(--font-size-xs)", color: "var(--color-muted-foreground)" }}>
              Submitted {new Date(evidence.submittedAt).toLocaleString()}
            </span>
          </div>

          {!evidence.verifiedAt ? (
            <div style={{ marginTop: "var(--space-3)" }}>
              <Button onClick={handleVerify} disabled={verifying}>
                {verifying ? "Verifying…" : "Verify evidence"}
              </Button>
              <p style={{ margin: "var(--space-2) 0 0", fontSize: "var(--font-size-xs)", color: "var(--color-muted-foreground)" }}>
                Confirms these photos show the issue genuinely fixed — required before this issue can be
                moved to Resolved. Residents can also verify this independently from the Community tab.
              </p>
            </div>
          ) : null}
        </div>
      ) : null}

      {canUpload ? (
        <>
          {evidence ? (
            <p style={{ margin: "0 0 var(--space-3)", fontSize: "var(--font-size-sm)", fontWeight: 600 }}>
              This issue was reopened — submit a new round of evidence.
            </p>
          ) : (
            <p style={{ margin: "0 0 var(--space-3)", fontSize: "var(--font-size-sm)", color: "var(--color-muted-foreground)" }}>
              Upload a before and an after photo to submit this as resolved. Resolving requires verified
              evidence on file.
            </p>
          )}
          <div style={{ display: "flex", gap: "var(--space-4)", flexWrap: "wrap", marginBottom: "var(--space-3)" }}>
            <label style={{ flex: 1, minWidth: 160 }}>
              <span style={{ display: "block", fontSize: "var(--font-size-sm)", fontWeight: 600, marginBottom: "var(--space-1)" }}>
                Before photo
              </span>
              <input
                ref={beforeRef}
                type="file"
                accept="image/*"
                onChange={(e) => setBeforeFile(e.target.files?.[0] ?? null)}
              />
            </label>
            <label style={{ flex: 1, minWidth: 160 }}>
              <span style={{ display: "block", fontSize: "var(--font-size-sm)", fontWeight: 600, marginBottom: "var(--space-1)" }}>
                After photo
              </span>
              <input
                ref={afterRef}
                type="file"
                accept="image/*"
                onChange={(e) => setAfterFile(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What was done to fix this? (optional)"
            style={{
              width: "100%",
              minHeight: 80,
              marginBottom: "var(--space-3)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-control)",
              background: "var(--color-surface-muted)",
              color: "var(--color-foreground)",
              fontFamily: "inherit",
              fontSize: "var(--font-size-sm)",
              padding: "var(--space-3) var(--space-4)",
              resize: "vertical",
            }}
          />
          {error ? (
            <p role="alert" className={styles.errorText} style={{ marginBottom: "var(--space-3)" }}>
              {error}
            </p>
          ) : null}
          {message ? (
            <p role="status" style={{ color: "var(--color-civic-green)", fontSize: "var(--font-size-sm)", marginBottom: "var(--space-3)" }}>
              {message}
            </p>
          ) : null}
          <Button onClick={handleSubmit} disabled={uploading || !isSupabaseConfigured}>
            {uploading ? "Uploading…" : "Submit evidence"}
          </Button>
        </>
      ) : !evidence ? (
        <p style={{ margin: 0, fontSize: "var(--font-size-sm)", color: "var(--color-muted-foreground)" }}>
          This issue is closed — no further evidence can be submitted.
        </p>
      ) : null}
    </Card>
  );
}
