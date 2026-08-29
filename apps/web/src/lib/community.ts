import { createServerSupabase } from "./supabase-server";
import { CATEGORY_LABEL } from "./status";
import type { IssueCategory, IssueStatus } from "./types";

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
  evidenceSubmittedAt: string | null;
  verifiedAt: string | null;
  completedCount: number;
  needsWorkCount: number;
}

interface RawFeedRow {
  id: string;
  tracking_id: string;
  category: IssueCategory;
  status: IssueStatus;
  neighborhood: string | null;
  description: string;
  completion_note: string | null;
  before_media_id: string | null;
  after_media_id: string | null;
  evidence_submitted_at: string | null;
  verified_at: string | null;
  completed_count: number;
  needs_work_count: number;
}

const SIGNED_URL_TTL_SECONDS = 60 * 10;

async function signMedia(
  supabase: NonNullable<Awaited<ReturnType<typeof createServerSupabase>>>,
  mediaIds: (string | null)[],
): Promise<Map<string, string>> {
  const ids = mediaIds.filter((id): id is string => Boolean(id));
  if (ids.length === 0) return new Map();

  const { data: mediaRows } = await supabase.from("issue_media").select("id, storage_key").in("id", ids);
  const urlByMediaId = new Map<string, string>();
  if (!mediaRows) return urlByMediaId;

  await Promise.all(
    mediaRows.map(async (row) => {
      const { data } = await supabase.storage
        .from("issue-media")
        .createSignedUrl(row.storage_key, SIGNED_URL_TTL_SECONDS);
      if (data?.signedUrl) urlByMediaId.set(row.id, data.signedUrl);
    }),
  );

  return urlByMediaId;
}

/** Issues open for or recently through community verification, with signed photo URLs. */
export async function fetchCommunityFeed(): Promise<CommunityFeedItem[]> {
  const supabase = await createServerSupabase();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("community_verification_feed")
    .select("*")
    .order("evidence_submitted_at", { ascending: false })
    .limit(50);

  if (error || !data) return [];

  const rows = data as RawFeedRow[];
  const mediaIds = rows.flatMap((r) => [r.before_media_id, r.after_media_id]);
  const urlByMediaId = await signMedia(supabase, mediaIds);

  return rows.map((row) => ({
    id: row.id,
    trackingId: row.tracking_id,
    category: row.category,
    categoryLabel: CATEGORY_LABEL[row.category],
    status: row.status,
    neighborhood: row.neighborhood ?? "Unspecified",
    description: row.description,
    completionNote: row.completion_note,
    beforePhotoUrl: row.before_media_id ? (urlByMediaId.get(row.before_media_id) ?? null) : null,
    afterPhotoUrl: row.after_media_id ? (urlByMediaId.get(row.after_media_id) ?? null) : null,
    evidenceSubmittedAt: row.evidence_submitted_at,
    verifiedAt: row.verified_at,
    completedCount: row.completed_count,
    needsWorkCount: row.needs_work_count,
  }));
}

export interface MyVote {
  issueId: string;
  vote: "completed" | "needs_work";
  comment: string | null;
}

export async function fetchMyVotes(userId: string): Promise<Map<string, MyVote>> {
  const supabase = await createServerSupabase();
  if (!supabase) return new Map();

  const { data } = await supabase
    .from("community_votes")
    .select("issue_id, vote, comment")
    .eq("user_id", userId);

  const map = new Map<string, MyVote>();
  (data ?? []).forEach((row) => {
    map.set(row.issue_id, { issueId: row.issue_id, vote: row.vote, comment: row.comment });
  });
  return map;
}
