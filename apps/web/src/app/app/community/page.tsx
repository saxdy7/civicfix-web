"use client";

import { useQuery } from "convex/react";

import { Card } from "@civicfix/ui-web";

import { api } from "@convex/_generated/api";

import styles from "../resident.module.css";
import { VoteCard } from "./VoteCard";

export default function CommunityPage() {
  const feed = useQuery(api.communityVotes.feed, {});
  const myVotes = useQuery(api.communityVotes.myVotes, {});
  const myVoteByIssue = new Map((myVotes ?? []).map((v) => [v.issueId, v]));

  return (
    <div>
      <div className={styles.pageHeader}>
        <h1 className={styles.title}>Community verification</h1>
        <p className={styles.subtitle}>
          Help confirm resolved work near you. Every signed-in resident gets one vote per report —
          reporters can&apos;t vote on their own.
        </p>
      </div>

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
