import { useCallback, useState } from "react";
import { ActivityIndicator, Image, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View, Pressable } from "react-native";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";

import { EmptyState } from "../../components/EmptyState";
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
    <View style={styles.voteCard}>
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
          <Text style={{ fontFamily: fontFamily.semibold, color: "#ffffff" }}>Field note: </Text>
          {item.completionNote}
        </Text>
      ) : null}

      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${completedPct}%` }]} />
      </View>
      <Text style={styles.progressLabel}>
        {item.completedCount} confirmed · {item.needsWorkCount} needs work
      </Text>

      {item.status === "resolved" ? (
        <View style={styles.verifiedSuccessBadge}>
          <Ionicons name="checkmark-circle" size={14} color="#22c55e" />
          <Text style={styles.resolvedNote}>
            Verified by Community Quorum on {item.verifiedAt ? new Date(item.verifiedAt).toLocaleDateString() : "recent"}
          </Text>
        </View>
      ) : (
        <View style={{ gap: 8, marginTop: 4 }}>
          {myVote ? (
            <Text style={styles.votedNote}>
              You voted: <Text style={{ fontFamily: fontFamily.bold, color: "#ffffff" }}>{myVote.vote === "completed" ? "Work completed 👍" : "Still needs work 👎"}</Text>
            </Text>
          ) : null}
          <TextInput
            style={styles.commentBox}
            placeholder="Optional verification note or comment..."
            placeholderTextColor="#8e8e8e"
            value={comment}
            onChangeText={setComment}
            multiline
          />
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          <View style={styles.actions}>
            <Pressable
              style={[styles.voteActionBtn, { backgroundColor: "#ffffff" }]}
              disabled={busy !== null}
              onPress={() => handleVote("completed")}
            >
              <Ionicons name="thumbs-up" size={14} color="#000000" />
              <Text style={[styles.voteActionBtnText, { color: "#000000" }]}>
                {busy === "completed" ? "Saving…" : "Looks Great"}
              </Text>
            </Pressable>

            <Pressable
              style={[styles.voteActionBtn, { backgroundColor: "#18181b", borderWidth: 1, borderColor: "#27272a" }]}
              disabled={busy !== null}
              onPress={() => handleVote("needs_work")}
            >
              <Ionicons name="thumbs-down" size={14} color="#ffffff" />
              <Text style={[styles.voteActionBtnText, { color: "#ffffff" }]}>
                {busy === "needs_work" ? "Saving…" : "Incomplete"}
              </Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
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
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#ffffff" />
        }
      >
        <View style={styles.topHeaderWrap}>
          <Text style={styles.pageTitle}>Community Consensus</Text>
          <Text style={styles.pageSubtitle}>
            Inspect Before & After photo evidence submitted by municipal field crews and certify resolution.
          </Text>
        </View>

        {loading ? (
          <ActivityIndicator color="#ffffff" style={{ marginTop: spacing[6] }} />
        ) : feed.length === 0 ? (
          <EmptyState
            icon="people-outline"
            title="Nothing to verify yet"
            description="Reports move here once field evidence has been submitted by municipal workers."
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
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#000000",
  },
  scrollContainer: {
    flex: 1,
    backgroundColor: "#000000",
  },
  scrollContent: {
    paddingHorizontal: spacing[4],
    paddingTop: spacing[2],
    paddingBottom: spacing[8] + 20,
    gap: spacing[4],
  },
  topHeaderWrap: {
    gap: 4,
  },
  pageTitle: {
    fontSize: 26,
    fontFamily: fontFamily.bold,
    color: "#ffffff",
    letterSpacing: -0.5,
  },
  pageSubtitle: {
    fontSize: 12,
    fontFamily: fontFamily.regular,
    color: "#8e8e8e",
    lineHeight: 16,
  },
  voteCard: {
    backgroundColor: "#121214",
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: "#27272a",
    gap: spacing[3],
  },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  tracking: {
    fontSize: 17,
    fontFamily: fontFamily.bold,
    color: "#ffffff",
  },
  meta: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.regular,
    color: "#8e8e8e",
    marginTop: 2,
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
    fontSize: 10,
    fontFamily: fontFamily.bold,
    color: "#8e8e8e",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  photo: {
    width: "100%",
    height: 110,
    borderRadius: 14,
  },
  photoPlaceholder: {
    width: "100%",
    height: 110,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#27272a",
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#18181b",
  },
  placeholderText: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.regular,
    color: "#8e8e8e",
  },
  completionNote: {
    fontSize: 12,
    fontFamily: fontFamily.regular,
    color: "#d4d4d8",
    lineHeight: 18,
  },
  progressTrack: {
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: "#18181b",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#22c55e",
    borderRadius: radius.pill,
  },
  progressLabel: {
    fontSize: 11,
    fontFamily: fontFamily.medium,
    color: "#8e8e8e",
  },
  verifiedSuccessBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(34, 197, 94, 0.12)",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    alignSelf: "flex-start",
  },
  resolvedNote: {
    fontSize: 11,
    fontFamily: fontFamily.semibold,
    color: "#22c55e",
  },
  votedNote: {
    fontSize: 11,
    fontFamily: fontFamily.regular,
    color: "#8e8e8e",
  },
  commentBox: {
    minHeight: 46,
    padding: spacing[3],
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#27272a",
    backgroundColor: "#18181b",
    color: "#ffffff",
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    textAlignVertical: "top",
  },
  actions: {
    flexDirection: "row",
    gap: spacing[2],
  },
  voteActionBtn: {
    flex: 1,
    height: 42,
    borderRadius: radius.pill,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  voteActionBtnText: {
    fontSize: 13,
    fontFamily: fontFamily.bold,
  },
  errorText: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.medium,
    color: "#ef4444",
  },
});
