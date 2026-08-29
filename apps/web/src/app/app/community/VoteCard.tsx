"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Badge, Button, Card } from "@civicfix/ui-web";

import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { STATUS_SHORT_LABEL } from "@/lib/status";
import type { CommunityFeedItem, MyVote } from "@/lib/community";

import styles from "./community.module.css";

export function VoteCard({ item, myVote }: { item: CommunityFeedItem; myVote: MyVote | null }) {
  const router = useRouter();
  const [comment, setComment] = useState(myVote?.comment ?? "");
  const [busy, setBusy] = useState<"completed" | "needs_work" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [castVote, setCastVote] = useState<MyVote | null>(myVote);

  const total = item.completedCount + item.needsWorkCount;
  const completedPct = total > 0 ? Math.round((item.completedCount / total) * 100) : 0;

  const handleVote = async (vote: "completed" | "needs_work") => {
    if (!supabase || !isSupabaseConfigured) {
      setError("Voting isn't available in preview mode.");
      return;
    }
    setBusy(vote);
    setError(null);
    const { error: rpcError } = await supabase.rpc("cast_community_vote", {
      p_issue_id: item.id,
      p_vote: vote,
      p_comment: comment.trim() || null,
    });
    setBusy(null);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    setCastVote({ issueId: item.id, vote, comment: comment.trim() || null });
    router.refresh();
  };

  return (
    <Card className={styles.card}>
      <div className={styles.header}>
        <div>
          <p className={styles.tracking}>{item.trackingId}</p>
          <p className={styles.meta}>
            {item.categoryLabel} · {item.neighborhood}
          </p>
        </div>
        <Badge tone={item.status === "resolved" ? "success" : "info"}>{STATUS_SHORT_LABEL[item.status]}</Badge>
      </div>

      <div className={styles.photoRow}>
        <div className={styles.photoCol}>
          <span className={styles.photoLabel}>Before</span>
          {item.beforePhotoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.beforePhotoUrl} alt="Before the fix" className={styles.photo} />
          ) : (
            <div className={styles.photoPlaceholder}>No before photo</div>
          )}
        </div>
        <div className={styles.photoCol}>
          <span className={styles.photoLabel}>After</span>
          {item.afterPhotoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.afterPhotoUrl} alt="After the fix" className={styles.photo} />
          ) : (
            <div className={styles.photoPlaceholder}>No after photo</div>
          )}
        </div>
      </div>

      {item.completionNote ? (
        <p className={styles.completionNote}>
          <strong>Field note:</strong> {item.completionNote}
        </p>
      ) : null}

      <div className={styles.progressRow}>
        <div className={styles.progressTrack}>
          <div className={styles.progressFill} style={{ width: `${completedPct}%` }} />
        </div>
        <span className={styles.progressLabel}>
          {item.completedCount} completed · {item.needsWorkCount} needs work
        </span>
      </div>

      {item.status === "resolved" ? (
        <p className={styles.resolvedNote}>Verified {item.verifiedAt ? new Date(item.verifiedAt).toLocaleDateString() : ""}.</p>
      ) : castVote ? (
        <p className={styles.votedNote}>
          You voted <strong>{castVote.vote === "completed" ? "Work completed" : "Still needs work"}</strong>. You
          can change your vote below.
        </p>
      ) : null}

      {item.status === "pending_verification" ? (
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
