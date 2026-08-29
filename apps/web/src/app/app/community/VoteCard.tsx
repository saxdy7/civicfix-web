"use client";

import { useMutation, useQuery } from "convex/react";
import { useState } from "react";

import { Badge, Button, Card } from "@civicfix/ui-web";

import { CATEGORY_LABEL, STATUS_SHORT_LABEL } from "@/lib/status";

import { api } from "@convex/_generated/api";
import type { Doc, Id } from "@convex/_generated/dataModel";

import styles from "./community.module.css";

function EvidencePhoto({ mediaId, label }: { mediaId: Id<"issueMedia"> | undefined; label: string }) {
  const url = useQuery(api.issueMedia.getUrl, mediaId ? { mediaId } : "skip");

  if (!mediaId || url === null) {
    return <div className={styles.photoPlaceholder}>No {label.toLowerCase()} photo</div>;
  }
  if (url === undefined) {
    return <div className={styles.photoPlaceholder}>Loading…</div>;
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={`${label} the fix`} className={styles.photo} />;
}

export function VoteCard({
  issue,
  evidence,
  completedCount,
  needsWorkCount,
  myVote,
}: {
  issue: Doc<"issues">;
  evidence: Doc<"resolutionEvidence"> | null;
  completedCount: number;
  needsWorkCount: number;
  myVote: { vote: "completed" | "needs_work"; comment?: string } | null;
}) {
  const castVote = useMutation(api.communityVotes.cast);
  const [comment, setComment] = useState(myVote?.comment ?? "");
  const [busy, setBusy] = useState<"completed" | "needs_work" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const total = completedCount + needsWorkCount;
  const completedPct = total > 0 ? Math.round((completedCount / total) * 100) : 0;

  const handleVote = async (vote: "completed" | "needs_work") => {
    setBusy(vote);
    setError(null);
    try {
      await castVote({ issueId: issue._id, vote, comment: comment.trim() || undefined });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save your vote.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card className={styles.card}>
      <div className={styles.header}>
        <div>
          <p className={styles.tracking}>{issue.trackingId}</p>
          <p className={styles.meta}>
            {CATEGORY_LABEL[issue.category]} · {issue.neighborhood ?? "Unspecified"}
          </p>
        </div>
        <Badge tone={issue.status === "resolved" ? "success" : "info"}>{STATUS_SHORT_LABEL[issue.status]}</Badge>
      </div>

      <div className={styles.photoRow}>
        <div className={styles.photoCol}>
          <span className={styles.photoLabel}>Before</span>
          <EvidencePhoto mediaId={evidence?.beforeMediaId} label="Before" />
        </div>
        <div className={styles.photoCol}>
          <span className={styles.photoLabel}>After</span>
          <EvidencePhoto mediaId={evidence?.afterMediaId} label="After" />
        </div>
      </div>

      {evidence?.note ? (
        <p className={styles.completionNote}>
          <strong>Field note:</strong> {evidence.note}
        </p>
      ) : null}

      <div className={styles.progressRow}>
        <div className={styles.progressTrack}>
          <div className={styles.progressFill} style={{ width: `${completedPct}%` }} />
        </div>
        <span className={styles.progressLabel}>
          {completedCount} completed · {needsWorkCount} needs work
        </span>
      </div>

      {issue.status === "resolved" ? (
        <p className={styles.resolvedNote}>
          Verified {evidence?.verifiedAt ? new Date(evidence.verifiedAt).toLocaleDateString() : ""}.
        </p>
      ) : myVote ? (
        <p className={styles.votedNote}>
          You voted <strong>{myVote.vote === "completed" ? "Work completed" : "Still needs work"}</strong>. You
          can change your vote below.
        </p>
      ) : null}

      {issue.status === "pending_verification" ? (
        <>
          <textarea
            className={styles.commentBox}
            placeholder="Optional comment (visible to other residents and staff)"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
          {error ? (
            <p role="alert" className={styles.errorText}>
              {error}
            </p>
          ) : null}
          <div className={styles.actions}>
            <Button variant="secondary" disabled={busy !== null} onClick={() => handleVote("completed")}>
              {busy === "completed" ? "Saving…" : "Work completed"}
            </Button>
            <Button variant="secondary" disabled={busy !== null} onClick={() => handleVote("needs_work")}>
              {busy === "needs_work" ? "Saving…" : "Still needs work"}
            </Button>
          </div>
        </>
      ) : null}
    </Card>
  );
}
