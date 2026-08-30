import { useCallback, useState } from "react";
import { ActivityIndicator, Image, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View, Pressable } from "react-native";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";

import { EmptyState } from "../../components/EmptyState";
import { StatusBadge } from "../../components/StatusBadge";
import { useAuth } from "../../lib/auth-context";
import { useTheme } from "../../lib/theme-context";
import { castCommunityVote, fetchCommunityFeed, fetchMyVotes, type CommunityFeedItem, type MyVote } from "../../lib/repositories/community";
import { fontFamily, fontSize, radius, spacing } from "../../lib/theme";

function VoteRow({ item, myVote, onVoted }: { item: CommunityFeedItem; myVote: MyVote | null; onVoted: (vote: MyVote) => void }) {
  const { colors } = useTheme();
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
    <View style={[styles.voteCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.rowBetween}>
        <View>
          <Text style={[styles.tracking, { color: colors.foreground }]}>{item.trackingId}</Text>
          <Text style={[styles.meta, { color: colors.mutedForeground }]}>
            {item.categoryLabel} · {item.neighborhood}
          </Text>
        </View>
        <StatusBadge status={item.status} />
      </View>

      <View style={styles.photoRow}>
        <View style={styles.photoCol}>
          <Text style={[styles.photoLabel, { color: colors.mutedForeground }]}>Before</Text>
          {item.beforePhotoUrl ? (
            <Image source={{ uri: item.beforePhotoUrl }} style={styles.photo} />
          ) : (
            <View style={[styles.photoPlaceholder, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
              <Text style={[styles.placeholderText, { color: colors.dimForeground }]}>No photo</Text>
            </View>
          )}
        </View>
        <View style={styles.photoCol}>
          <Text style={[styles.photoLabel, { color: colors.mutedForeground }]}>After</Text>
          {item.afterPhotoUrl ? (
            <Image source={{ uri: item.afterPhotoUrl }} style={styles.photo} />
          ) : (
            <View style={[styles.photoPlaceholder, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
              <Text style={[styles.placeholderText, { color: colors.dimForeground }]}>No photo</Text>
            </View>
          )}
        </View>
      </View>

      <Text style={[styles.description, { color: colors.foreground }]}>{item.description}</Text>

      {/* Progress Bar */}
      <View style={styles.progressSection}>
        <View style={styles.rowBetween}>
          <Text style={[styles.progressLabel, { color: colors.mutedForeground }]}>Community consensus</Text>
          <Text style={[styles.progressValue, { color: colors.foreground }]}>
            {completedPct}% verified ({total} {total === 1 ? "vote" : "votes"})
          </Text>
        </View>
        <View style={[styles.track, { backgroundColor: colors.surfaceMuted }]}>
          <View style={[styles.fill, { width: `${completedPct}%` }]} />
        </View>
      </View>

      {/* Comment Input */}
      {!myVote && (
        <TextInput
          style={[styles.commentInput, { backgroundColor: colors.surfaceMuted, borderColor: colors.border, color: colors.foreground }]}
          placeholder="Add optional note for the neighborhood…"
          placeholderTextColor={colors.dimForeground}
          value={comment}
          onChangeText={setComment}
          maxLength={500}
        />
      )}

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {/* Vote Actions */}
      {myVote ? (
        <View style={[styles.votedBadge, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
          <Ionicons
            name={myVote.vote === "completed" ? "checkmark-circle" : "close-circle"}
            size={18}
            color={myVote.vote === "completed" ? "#22c55e" : "#ef4444"}
          />
          <Text style={[styles.votedText, { color: colors.foreground }]}>
            You voted: {myVote.vote === "completed" ? "Looks Fixed" : "Needs Work"}
          </Text>
        </View>
      ) : (
        <View style={styles.voteButtonsRow}>
          <Pressable
            style={[styles.voteBtn, styles.voteBtnPositive, busy !== null && styles.voteBtnDisabled]}
            disabled={busy !== null}
            onPress={() => handleVote("completed")}
          >
            {busy === "completed" ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <>
                <Ionicons name="checkmark" size={16} color="#ffffff" />
                <Text style={styles.voteBtnPositiveText}>Looks Fixed</Text>
              </>
            )}
          </Pressable>

          <Pressable
            style={[styles.voteBtn, styles.voteBtnNegative, busy !== null && styles.voteBtnDisabled]}
            disabled={busy !== null}
            onPress={() => handleVote("needs_work")}
          >
            {busy === "needs_work" ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <>
                <Ionicons name="close" size={16} color="#ffffff" />
                <Text style={styles.voteBtnNegativeText}>Needs Work</Text>
              </>
            )}
          </Pressable>
        </View>
      )}
    </View>
  );
}

export default function Community() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const [feed, setFeed] = useState<CommunityFeedItem[]>([]);
  const [myVotes, setMyVotes] = useState<Record<string, MyVote>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [items, votes] = await Promise.all([
      fetchCommunityFeed(),
      fetchMyVotes(user?.id),
    ]);
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

  const handleVoted = (issueId: string, vote: MyVote) => {
    setMyVotes((prev) => ({ ...prev, [issueId]: vote }));
    setFeed((prev) =>
      prev.map((item) => {
        if (item.id !== issueId) return item;
        return {
          ...item,
          completedCount: vote.vote === "completed" ? item.completedCount + 1 : item.completedCount,
          needsWorkCount: vote.vote === "needs_work" ? item.needsWorkCount + 1 : item.needsWorkCount,
        };
      }),
    );
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={["top"]}>
      <ScrollView
        style={[styles.scrollContainer, { backgroundColor: colors.background }]}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.foreground} />
        }
      >
        <View style={styles.pageHeader}>
          <Text style={[styles.pageTitle, { color: colors.foreground }]}>Community Feed</Text>
          <Text style={[styles.pageSubtitle, { color: colors.mutedForeground }]}>
            Review municipal repairs and cast consensus votes.
          </Text>
        </View>

        {loading && !refreshing ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={colors.foreground} />
          </View>
        ) : feed.length === 0 ? (
          <EmptyState
            title="No items awaiting verification"
            description="When municipal field crews resolve reported issues, Before & After evidence will appear here for community consensus."
          />
        ) : (
          <View style={styles.feedList}>
            {feed.map((item) => (
              <VoteRow
                key={item.id}
                item={item}
                myVote={myVotes[item.id] ?? null}
                onVoted={(vote) => handleVoted(item.id, vote)}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing[4],
    paddingTop: spacing[2],
    paddingBottom: spacing[8] + 20,
    gap: spacing[4],
  },
  pageHeader: {
    gap: 4,
  },
  pageTitle: {
    fontSize: 26,
    fontFamily: fontFamily.bold,
    letterSpacing: -0.5,
  },
  pageSubtitle: {
    fontSize: 13,
    fontFamily: fontFamily.regular,
  },
  centerContainer: {
    paddingVertical: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  feedList: {
    gap: 16,
  },
  voteCard: {
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    gap: 12,
  },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  tracking: {
    fontSize: 15,
    fontFamily: fontFamily.bold,
  },
  meta: {
    fontSize: 12,
    fontFamily: fontFamily.regular,
    marginTop: 2,
  },
  photoRow: {
    flexDirection: "row",
    gap: 10,
  },
  photoCol: {
    flex: 1,
    gap: 4,
  },
  photoLabel: {
    fontSize: 11,
    fontFamily: fontFamily.bold,
    textTransform: "uppercase",
  },
  photo: {
    width: "100%",
    height: 120,
    borderRadius: 14,
  },
  photoPlaceholder: {
    width: "100%",
    height: 120,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  placeholderText: {
    fontSize: 11,
    fontFamily: fontFamily.regular,
  },
  description: {
    fontSize: 13,
    fontFamily: fontFamily.regular,
    lineHeight: 18,
  },
  progressSection: {
    gap: 6,
  },
  progressLabel: {
    fontSize: 11,
    fontFamily: fontFamily.medium,
  },
  progressValue: {
    fontSize: 11,
    fontFamily: fontFamily.bold,
  },
  track: {
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    backgroundColor: "#22c55e",
    borderRadius: 3,
  },
  commentInput: {
    borderRadius: radius.control,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    fontFamily: fontFamily.regular,
  },
  errorText: {
    fontSize: 12,
    fontFamily: fontFamily.medium,
    color: "#ef4444",
  },
  votedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  votedText: {
    fontSize: 13,
    fontFamily: fontFamily.semibold,
  },
  voteButtonsRow: {
    flexDirection: "row",
    gap: 10,
  },
  voteBtn: {
    flex: 1,
    height: 42,
    borderRadius: radius.pill,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  voteBtnPositive: {
    backgroundColor: "#16a34a",
  },
  voteBtnPositiveText: {
    fontSize: 13,
    fontFamily: fontFamily.bold,
    color: "#ffffff",
  },
  voteBtnNegative: {
    backgroundColor: "#dc2626",
  },
  voteBtnNegativeText: {
    fontSize: 13,
    fontFamily: fontFamily.bold,
    color: "#ffffff",
  },
  voteBtnDisabled: {
    opacity: 0.6,
  },
});
