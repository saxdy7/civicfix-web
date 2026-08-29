import { useCallback, useState } from "react";
import { ActivityIndicator, Image, RefreshControl, Text, TextInput, View, StyleSheet } from "react-native";
import { useFocusEffect } from "expo-router";

import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { EmptyState } from "../../components/EmptyState";
import { ScreenContainer } from "../../components/ScreenContainer";
import { StatusBadge } from "../../components/StatusBadge";
import { useAuth } from "../../lib/auth-context";
import { castCommunityVote, fetchCommunityFeed, fetchMyVotes, type CommunityFeedItem, type MyVote } from "../../lib/repositories/community";
import { color, fontFamily, fontSize, radius, spacing } from "../../lib/theme";

function VoteRow({ item, myVote, onVoted }: { item: CommunityFeedItem; myVote: MyVote | null; onVoted: (vote: MyVote) => void }) {
  const [comment, setComment] = useState(myVote?.comment ?? "");
  const [busy, setBusy] = useState<"completed" | "needs_work" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const total = item.completedCount + item.needsWorkCount;
  const completedPct = total > 0 ? Math.round((item.completedCount / total) * 100) : 0;

  const handleVote = async (vote: "completed" | "needs_work") => {
    setBusy(vote);
    setError(null);
    const { error: voteError } = await castCommunityVote(item.id, vote, comment.trim() || null);
    setBusy(null);
    if (voteError) {
      setError(voteError);
      return;
    }
    onVoted({ vote, comment: comment.trim() || null });
  };

  return (
    <Card style={{ marginBottom: spacing[3], gap: spacing[3] }}>
      <View style={styles.rowBetween}>
        <View>
          <Text style={styles.tracking}>{item.trackingId}</Text>
          <Text style={styles.meta}>
            {item.categoryLabel} · {item.neighborhood}
          </Text>
        </View>
        <StatusBadge status={item.status} />
      </View>

      <View style={styles.photoRow}>
        <View style={styles.photoCol}>
          <Text style={styles.photoLabel}>Before</Text>
          {item.beforePhotoUrl ? (
            <Image source={{ uri: item.beforePhotoUrl }} style={styles.photo} />
          ) : (
            <View style={styles.photoPlaceholder}>
              <Text style={styles.placeholderText}>No photo</Text>
            </View>
          )}
        </View>
        <View style={styles.photoCol}>
          <Text style={styles.photoLabel}>After</Text>
          {item.afterPhotoUrl ? (
            <Image source={{ uri: item.afterPhotoUrl }} style={styles.photo} />
          ) : (
            <View style={styles.photoPlaceholder}>
              <Text style={styles.placeholderText}>No photo</Text>
            </View>
          )}
        </View>
      </View>

      {item.completionNote ? (
        <Text style={styles.completionNote}>
          <Text style={{ fontFamily: fontFamily.semibold }}>Field note: </Text>
          {item.completionNote}
        </Text>
      ) : null}

      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${completedPct}%` }]} />
      </View>
      <Text style={styles.progressLabel}>
        {item.completedCount} completed · {item.needsWorkCount} needs work
      </Text>

      {item.status === "resolved" ? (
        <Text style={styles.resolvedNote}>
          Verified {item.verifiedAt ? new Date(item.verifiedAt).toLocaleDateString() : ""}.
        </Text>
      ) : (
        <>
          {myVote ? (
            <Text style={styles.votedNote}>
              You voted <Text style={{ fontFamily: fontFamily.semibold }}>{myVote.vote === "completed" ? "Work completed" : "Still needs work"}</Text>.
              You can change your vote below.
            </Text>
          ) : null}
          <TextInput
            style={styles.commentBox}
            placeholder="Optional comment"
            placeholderTextColor={color.dimForeground}
            value={comment}
            onChangeText={setComment}
            multiline
          />
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          <View style={styles.actions}>
            <Button
              label={busy === "completed" ? "Saving…" : "Work completed"}
              variant="secondary"
              disabled={busy !== null}
              onPress={() => handleVote("completed")}
              style={{ flex: 1 }}
            />
            <Button
              label={busy === "needs_work" ? "Saving…" : "Still needs work"}
              variant="secondary"
              disabled={busy !== null}
              onPress={() => handleVote("needs_work")}
              style={{ flex: 1 }}
            />
          </View>
        </>
      )}
    </Card>
  );
}

export default function Community() {
  const { user } = useAuth();
  const [feed, setFeed] = useState<CommunityFeedItem[]>([]);
  const [myVotes, setMyVotes] = useState<Map<string, MyVote>>(new Map());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const [items, votes] = await Promise.all([fetchCommunityFeed(), fetchMyVotes(user.id)]);
    setFeed(items);
    setMyVotes(votes);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      load().finally(() => active && setLoading(false));
      return () => {
        active = false;
      };
    }, [load]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <ScreenContainer refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={color.foreground} />}>
      <Text style={styles.pageTitle}>Community verification</Text>
      <Text style={styles.pageSubtitle}>
        Help confirm resolved work near you — one vote per report, and reporters can&apos;t vote on their
        own.
      </Text>

      {loading ? (
        <ActivityIndicator color={color.civicBlue} />
      ) : feed.length === 0 ? (
        <EmptyState
          icon="people-outline"
          title="Nothing to verify yet"
          description="Reports move here once field evidence has been submitted."
        />
      ) : (
        feed.map((item) => (
          <VoteRow
            key={item.id}
            item={item}
            myVote={myVotes.get(item.id) ?? null}
            onVoted={(vote) => setMyVotes((prev) => new Map(prev).set(item.id, vote))}
          />
        ))
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  pageTitle: {
    fontSize: fontSize.xl,
    fontFamily: fontFamily.bold,
    color: color.foreground,
    letterSpacing: -0.4,
  },
  pageSubtitle: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.regular,
    color: color.mutedForeground,
    marginBottom: spacing[2],
  },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  tracking: {
    fontSize: fontSize.md,
    fontFamily: fontFamily.semibold,
    color: color.foreground,
  },
  meta: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.regular,
    color: color.mutedForeground,
  },
  photoRow: {
    flexDirection: "row",
    gap: spacing[3],
  },
  photoCol: {
    flex: 1,
    gap: spacing[1],
  },
  photoLabel: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.semibold,
    color: color.mutedForeground,
    textTransform: "uppercase",
  },
  photo: {
    width: "100%",
    height: 110,
    borderRadius: radius.control,
  },
  photoPlaceholder: {
    width: "100%",
    height: 110,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: color.border,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
  },
  placeholderText: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.regular,
    color: color.dimForeground,
  },
  completionNote: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.regular,
    color: color.mutedForeground,
    lineHeight: 20,
  },
  progressTrack: {
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: color.surfaceMuted,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: color.civicGreen,
    borderRadius: radius.pill,
  },
  progressLabel: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.regular,
    color: color.mutedForeground,
  },
  resolvedNote: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.medium,
    color: color.civicGreen,
  },
  votedNote: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.regular,
    color: color.mutedForeground,
  },
  commentBox: {
    minHeight: 56,
    padding: spacing[3],
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surfaceMuted,
    color: color.foreground,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    textAlignVertical: "top",
  },
  actions: {
    flexDirection: "row",
    gap: spacing[2],
  },
  errorText: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.medium,
    color: color.civicRed,
  },
});
