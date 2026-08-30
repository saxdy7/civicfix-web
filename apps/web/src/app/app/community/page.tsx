"use client";

import { useQuery } from "convex/react";
import { Badge, Card } from "@civicfix/ui-web";

import { api } from "@convex/_generated/api";

import styles from "../resident.module.css";
import { VoteCard } from "./VoteCard";

export default function CommunityPage() {
  const feed = useQuery(api.communityVotes.feed, {});
  const myVotes = useQuery(api.communityVotes.myVotes, {});
  const leaderboard = useQuery(api.users.getLeaderboard, { limit: 4 });
  const myVoteByIssue = new Map((myVotes ?? []).map((v) => [v.issueId, v]));

  return (
    <div>
      <div className={styles.pageHeader}>
        <h1 className={styles.title}>Community verification</h1>
        <p className={styles.subtitle}>
          Help confirm resolved work near you. Every signed-in resident gets one vote per report —
          community consensus verifies repairs for city audit logs.
        </p>
      </div>

      {leaderboard && leaderboard.length > 0 ? (
        <Card style={{ marginBottom: "var(--space-5)", background: "linear-gradient(135deg, rgba(2, 132, 199, 0.08) 0%, rgba(16, 185, 129, 0.08) 100%)", border: "1px solid var(--color-border)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "1.25rem" }}>🏆</span>
              <strong style={{ fontSize: "1rem" }}>Top Community Champions</strong>
            </div>
            <Badge tone="info">Live Leaderboard</Badge>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "10px" }}>
            {leaderboard.map((user: { id: string; name: string; trustScore: number }, idx: number) => (
              <div
                key={user.id}
                style={{
                  background: "var(--color-surface, #fff)",
                  padding: "8px 12px",
                  borderRadius: "8px",
                  border: "1px solid var(--color-border)",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <span style={{ fontWeight: 800, color: idx === 0 ? "#f59e0b" : "#64748b", fontSize: "0.9rem" }}>
                  #{idx + 1}
                </span>
                <div style={{ overflow: "hidden" }}>
                  <div style={{ fontWeight: 600, fontSize: "0.825rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {user.name}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "#10b981", fontWeight: 700 }}>
                    ⚡ {user.trustScore} pts
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      {feed === undefined ? (
        <Card>
          <p className={styles.emptyState}>Loading…</p>
        </Card>
      ) : feed.length === 0 ? (
        <Card>
          <p className={styles.emptyState}>
            Nothing is waiting on community verification right now. Reports move here once field
            evidence has been submitted.
          </p>
        </Card>
      ) : (
        <div className={styles.reportList}>
          {feed.map((item) => (
            <VoteCard
              key={item.issue._id}
              issue={item.issue}
              evidence={item.evidence}
              completedCount={item.completedCount}
              needsWorkCount={item.needsWorkCount}
              myVote={myVoteByIssue.get(item.issue._id) ?? null}
            />
          ))}
        </div>
      )}
    </div>
  );
}
