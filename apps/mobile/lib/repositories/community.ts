import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

import { convexClient, convexErrorMessage } from "../convex-client";
import { CATEGORY_LABEL } from "../status";
import type { IssueCategory, IssueStatus } from "../types";

import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

export interface CommunityFeedItem {
  id: string;
  trackingId: string;
  category: IssueCategory;
  categoryLabel: string;
  status: IssueStatus;
  neighborhood: string;
  description: string;
  completionNote: string | null;
  beforePhotoUrl: string | null;
  afterPhotoUrl: string | null;
  verifiedAt: string | null;
  completedCount: number;
  needsWorkCount: number;
}

const LOCAL_VOTES_KEY = "civicfix.community_votes.v1";

export async function fetchCommunityFeed(): Promise<CommunityFeedItem[]> {
  if (!convexClient) return [];

  try {
    const rows = await convexClient.query(api.communityVotes.feed, {});

    const mediaIds = Array.from(
      new Set(
        rows
          .flatMap((r) => [r.evidence?.beforeMediaId, r.evidence?.afterMediaId])
          .filter((id): id is Id<"issueMedia"> => Boolean(id)),
      ),
    );
    const urlByMediaId = new Map<string, string | null>();
    await Promise.all(
      mediaIds.map(async (id) =>
        urlByMediaId.set(id, await convexClient!.query(api.issueMedia.getUrl, { mediaId: id })),
      ),
    );

    return rows.map((row) => ({
      id: row.issue._id,
      trackingId: row.issue.trackingId,
      category: row.issue.category,
      categoryLabel: CATEGORY_LABEL[row.issue.category],
      status: row.issue.status,
      neighborhood: row.issue.neighborhood ?? "Unspecified",
      description: row.issue.description,
      completionNote: row.evidence?.note ?? null,
      beforePhotoUrl: row.evidence?.beforeMediaId ? urlByMediaId.get(row.evidence.beforeMediaId) ?? null : null,
      afterPhotoUrl: row.evidence?.afterMediaId ? urlByMediaId.get(row.evidence.afterMediaId) ?? null : null,
      verifiedAt: row.evidence?.verifiedAt ? new Date(row.evidence.verifiedAt).toISOString() : null,
      completedCount: row.completedCount,
      needsWorkCount: row.needsWorkCount,
    }));
  } catch (err) {
    console.warn("fetchCommunityFeed error:", err);
    return [];
  }
}

export interface MyVote {
  vote: "completed" | "needs_work";
  comment: string | null;
}

export async function fetchMyVotes(_userId?: string): Promise<Record<string, MyVote>> {
  const result: Record<string, MyVote> = {};

  // 1. Load local offline-first persisted votes from device
  if (Platform.OS !== "web") {
    try {
      const raw = await SecureStore.getItemAsync(LOCAL_VOTES_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        Object.assign(result, parsed);
      }
    } catch {
      // Ignore
    }
  }

  // 2. Load from Convex backend
  if (convexClient) {
    try {
      const rows = await convexClient.query(api.communityVotes.myVotes, {});
      if (Array.isArray(rows)) {
        rows.forEach((row) => {
          result[row.issueId] = {
            vote: row.vote,
            comment: row.comment ?? null,
          };
        });
      }
    } catch (err) {
      console.warn("fetchMyVotes error:", err);
    }
  }

  return result;
}

export async function castCommunityVote(
  issueId: string,
  vote: "completed" | "needs_work",
  comment: string | null,
): Promise<{ error: string | null }> {
  // 1. Instantly persist to local SecureStore
  if (Platform.OS !== "web") {
    try {
      const raw = await SecureStore.getItemAsync(LOCAL_VOTES_KEY);
      const existing: Record<string, MyVote> = raw ? JSON.parse(raw) : {};
      existing[issueId] = { vote, comment };
      await SecureStore.setItemAsync(LOCAL_VOTES_KEY, JSON.stringify(existing));
    } catch {
      // Ignore
    }
  }

  // 2. Push to Convex backend
  if (!convexClient) return { error: null };
  try {
    await convexClient.mutation(api.communityVotes.cast, {
      issueId: issueId as Id<"issues">,
      vote,
      comment: comment ?? undefined,
    });
    return { error: null };
  } catch (err) {
    console.warn("castCommunityVote error:", err);
    return { error: convexErrorMessage(err) };
  }
}
