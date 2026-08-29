import { Card } from "@civicfix/ui-web";

import { fetchCommunityFeed, fetchMyVotes } from "@/lib/community";
import { getSessionProfile } from "@/lib/supabase-server";

import styles from "../resident.module.css";
import { VoteCard } from "./VoteCard";

export default async function CommunityPage() {
  const session = await getSessionProfile();
  const [feed, myVotes] = await Promise.all([
    fetchCommunityFeed(),
    session ? fetchMyVotes(session.userId) : Promise.resolve(new Map()),
  ]);

  return (
    <div>
      <div className={styles.pageHeader}>
        <h1 className={styles.title}>Community verification</h1>
        <p className={styles.subtitle}>
          Help confirm resolved work near you. Every signed-in resident gets one vote per report —
          reporters can&apos;t vote on their own.
        </p>
      </div>

      {feed.length === 0 ? (
        <Card>
          <p className={styles.emptyState}>
            Nothing is waiting on community verification right now. Reports move here once field
            evidence has been submitted.
          </p>
        </Card>
      ) : (
        <div className={styles.reportList}>
          {feed.map((item) => (
            <VoteCard key={item.id} item={item} myVote={session ? (myVotes.get(item.id) ?? null) : null} />
          ))}
        </div>
      )}
    </div>
  );
}
