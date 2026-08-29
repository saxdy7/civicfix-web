"use client";

import { useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";

import { Badge, Button, Card } from "@civicfix/ui-web";

import { api } from "@convex/_generated/api";
import type { Doc, Id } from "@convex/_generated/dataModel";
import type { IssueStatus } from "@/lib/types";

import styles from "../../admin.module.css";

async function sha256Hex(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function EvidenceImage({ mediaId, label }: { mediaId: Id<"issueMedia"> | undefined; label: string }) {
  const url = useQuery(api.issueMedia.getUrl, mediaId ? { mediaId } : "skip");
  if (!mediaId) {
    return <p style={{ fontSize: "var(--font-size-sm)", color: "var(--color-muted-foreground)" }}>No photo</p>;
  }
  if (!url) {
    return <p style={{ fontSize: "var(--font-size-sm)", color: "var(--color-muted-foreground)" }}>Loading…</p>;
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={label} style={{ width: "100%", borderRadius: "var(--radius-control)", display: "block" }} />;
}

export function EvidencePanel({ issue }: { issue: Doc<"issues"> }) {
  const assignment = useQuery(api.assignments.getByIssue, { issueId: issue._id });
  const evidence = useQuery(api.resolutionEvidence.latestForIssue, { issueId: issue._id });
  const generateUploadUrl = useMutation(api.issueMedia.generateUploadUrl);
  const saveMedia = useMutation(api.issueMedia.save);
  const submitEvidence = useMutation(api.resolutionEvidence.submit);
  const verifyEvidence = useMutation(api.resolutionEvidence.verify);
  const flagFalseReport = useMutation(api.issues.flagFalseReport);

  const beforeRef = useRef<HTMLInputElement>(null);
  const afterRef = useRef<HTMLInputElement>(null);
  const flagRef = useRef<HTMLInputElement>(null);

  const [beforeFile, setBeforeFile] = useState<File | null>(null);
  const [afterFile, setAfterFile] = useState<File | null>(null);
  const [note, setNote] = useState("");
  const [uploading, setUploading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [flagging, setFlagging] = useState(false);
  const [flagFile, setFlagFile] = useState<File | null>(null);
  const [flagReason, setFlagReason] = useState("");
  const [flagBusy, setFlagBusy] = useState(false);
  const [flagError, setFlagError] = useState<string | null>(null);

  const closed: IssueStatus[] = ["resolved", "rejected", "duplicate"];
  const canUpload = !closed.includes(issue.status) && (!evidence || issue.status === "reopened");

  async function uploadOne(file: File) {
    const uploadUrl = await generateUploadUrl();
    const res = await fetch(uploadUrl, { method: "POST", headers: { "Content-Type": file.type }, body: file });
    const { storageId } = await res.json();
    const checksum = await sha256Hex(file);
    return await saveMedia({ issueId: issue._id, storageId, mimeType: file.type, checksum, sizeBytes: file.size });
  }

  async function handleSubmit() {
    if (!beforeFile || !afterFile) {
      setError("Choose both a before and an after photo.");
      return;
    }
    setUploading(true);
    setError(null);
    setMessage(null);
    try {
      const [beforeMediaId, afterMediaId] = await Promise.all([uploadOne(beforeFile), uploadOne(afterFile)]);
      await submitEvidence({
        issueId: issue._id,
        assignmentId: assignment?._id,
        beforeMediaId,
        afterMediaId,
        note: note.trim() || undefined,
      });

      setMessage(
        issue.status === "in_progress"
          ? "Evidence recorded and status moved to Pending verification."
          : "Evidence recorded. Move this issue to In Progress, then Pending Verification, before it can be resolved.",
      );
      setBeforeFile(null);
      setAfterFile(null);
      if (beforeRef.current) beforeRef.current.value = "";
      if (afterRef.current) afterRef.current.value = "";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit evidence.");
    } finally {
      setUploading(false);
    }
  }

  async function handleVerify() {
    if (!evidence) return;
    setVerifying(true);
    setError(null);
    try {
      await verifyEvidence({ evidenceId: evidence._id });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not verify this evidence.");
    } finally {
      setVerifying(false);
    }
  }

  async function handleFlagFalseReport() {
    if (!flagFile) {
      setFlagError("Attach a site-verification photo showing why this looks like a false report.");
      return;
    }
    if (flagReason.trim().length < 10) {
      setFlagError("Explain why this looks like a false report (at least 10 characters).");
      return;
    }
    setFlagBusy(true);
    setFlagError(null);
    try {
      const evidenceMediaId = await uploadOne(flagFile);
      await flagFalseReport({ issueId: issue._id, reason: flagReason.trim(), evidenceMediaId });
      setFlagging(false);
      setFlagFile(null);
      setFlagReason("");
      if (flagRef.current) flagRef.current.value = "";
    } catch (err) {
      setFlagError(err instanceof Error ? err.message : "Could not flag this report.");
    } finally {
      setFlagBusy(false);
    }
  }

  return (
    <>
      <Card style={{ marginBottom: "var(--space-4)" }}>
        <h2 className={styles.sectionTitle}>Before / after evidence</h2>

        {evidence ? (
          <div style={{ marginBottom: canUpload ? "var(--space-5)" : 0 }}>
            <div style={{ display: "flex", gap: "var(--space-4)", flexWrap: "wrap", marginBottom: "var(--space-3)" }}>
              <div style={{ flex: 1, minWidth: 160 }}>
                <p style={{ fontSize: "var(--font-size-xs)", color: "var(--color-muted-foreground)", marginBottom: "var(--space-1)" }}>
                  Before
                </p>
                <EvidenceImage mediaId={evidence.beforeMediaId} label="Before" />
              </div>
              <div style={{ flex: 1, minWidth: 160 }}>
                <p style={{ fontSize: "var(--font-size-xs)", color: "var(--color-muted-foreground)", marginBottom: "var(--space-1)" }}>
                  After
                </p>
                <EvidenceImage mediaId={evidence.afterMediaId} label="After" />
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
                <input ref={beforeRef} type="file" accept="image/*" onChange={(e) => setBeforeFile(e.target.files?.[0] ?? null)} />
              </label>
              <label style={{ flex: 1, minWidth: 160 }}>
                <span style={{ display: "block", fontSize: "var(--font-size-sm)", fontWeight: 600, marginBottom: "var(--space-1)" }}>
                  After photo
                </span>
                <input ref={afterRef} type="file" accept="image/*" onChange={(e) => setAfterFile(e.target.files?.[0] ?? null)} />
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
            <Button onClick={handleSubmit} disabled={uploading}>
              {uploading ? "Uploading…" : "Submit evidence"}
            </Button>
          </>
        ) : !evidence ? (
          <p style={{ margin: 0, fontSize: "var(--font-size-sm)", color: "var(--color-muted-foreground)" }}>
            This issue is closed — no further evidence can be submitted.
          </p>
        ) : null}
      </Card>

      {issue.falseReportStatus === "none" && !closed.includes(issue.status) ? (
        <Card style={{ marginBottom: "var(--space-4)" }}>
          <h2 className={styles.sectionTitle}>Suspect a false report?</h2>
          <p style={{ margin: "0 0 var(--space-3)", fontSize: "var(--font-size-sm)", color: "var(--color-muted-foreground)" }}>
            You can&apos;t cancel a report on your own — flag it with site-verification evidence and an
            administrator will review it alongside the resident&apos;s report and any community context.
          </p>
          {flagging ? (
            <>
              <label style={{ display: "block", marginBottom: "var(--space-3)" }}>
                <span style={{ display: "block", fontSize: "var(--font-size-sm)", fontWeight: 600, marginBottom: "var(--space-1)" }}>
                  Site-verification photo
                </span>
                <input ref={flagRef} type="file" accept="image/*" onChange={(e) => setFlagFile(e.target.files?.[0] ?? null)} />
              </label>
              <textarea
                value={flagReason}
                onChange={(e) => setFlagReason(e.target.value)}
                placeholder="What did you find on-site that contradicts the report?"
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
              {flagError ? (
                <p role="alert" className={styles.errorText} style={{ marginBottom: "var(--space-3)" }}>
                  {flagError}
                </p>
              ) : null}
              <div style={{ display: "flex", gap: "var(--space-2)" }}>
                <Button variant="secondary" onClick={handleFlagFalseReport} disabled={flagBusy}>
                  {flagBusy ? "Submitting…" : "Submit for review"}
                </Button>
                <Button variant="secondary" onClick={() => setFlagging(false)} disabled={flagBusy}>
                  Cancel
                </Button>
              </div>
            </>
          ) : (
            <Button variant="secondary" onClick={() => setFlagging(true)}>
              Flag as suspected false report
            </Button>
          )}
        </Card>
      ) : issue.falseReportStatus === "under_review" ? (
        <Card style={{ marginBottom: "var(--space-4)" }}>
          <h2 className={styles.sectionTitle}>False-report review</h2>
          <Badge tone="warning">Under review</Badge>
          <p style={{ margin: "var(--space-2) 0 0", fontSize: "var(--font-size-sm)" }}>{issue.falseReportReason}</p>
        </Card>
      ) : null}
    </>
  );
}
