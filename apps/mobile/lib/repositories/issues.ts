import { decode } from "base64-arraybuffer";
import * as Crypto from "expo-crypto";

import { DEMO_ISSUES } from "../demo-data";
import { supabase } from "../supabase";
import type { Issue, IssueCategory, IssueEvent, IssueSeverity, IssueStatus } from "../types";

interface RawIssueRow {
  id: string;
  tracking_id: string;
  category: IssueCategory;
  status: IssueStatus;
  severity: IssueSeverity;
  description: string;
  neighborhood: string | null;
  location: unknown;
  created_at: string;
  updated_at: string;
  reporter_id?: string | null;
}

interface RawEventRow {
  id: string;
  issue_id?: string;
  status: IssueStatus;
  note: string | null;
  created_at: string;
}

const ISSUE_COLUMNS =
  "id, tracking_id, category, status, severity, description, neighborhood, location, created_at, updated_at";
const ISSUE_COLUMNS_WITH_REPORTER = `${ISSUE_COLUMNS}, reporter_id`;

function parseLocation(raw: unknown): { latitude: number; longitude: number } {
  if (raw && typeof raw === "object" && Array.isArray((raw as { coordinates?: unknown }).coordinates)) {
    const [lng, lat] = (raw as { coordinates: [number, number] }).coordinates;
    return { latitude: lat, longitude: lng };
  }
  return { latitude: 0, longitude: 0 };
}

function mapEvent(row: RawEventRow): IssueEvent {
  return { id: row.id, status: row.status, note: row.note ?? undefined, createdAt: row.created_at };
}

function mapIssue(row: RawIssueRow, events: RawEventRow[]): Issue {
  const { latitude, longitude } = parseLocation(row.location);
  return {
    id: row.id,
    trackingId: row.tracking_id,
    category: row.category,
    status: row.status,
    severity: row.severity,
    description: row.description,
    neighborhood: row.neighborhood ?? "Unspecified",
    latitude,
    longitude,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    events: events.map(mapEvent).sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    reporterId: row.reporter_id ?? undefined,
  };
}

/** The signed-in citizen's own reports, newest first. */
export async function fetchMyIssues(userId: string): Promise<Issue[]> {
  if (!supabase) return DEMO_ISSUES;

  const { data, error } = await supabase
    .from("issues")
    .select(ISSUE_COLUMNS)
    .eq("reporter_id", userId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error || !data || data.length === 0) return [];

  const ids = data.map((row) => row.id);
  const { data: eventRows } = await supabase
    .from("issue_events")
    .select("id, issue_id, status, note, created_at")
    .in("issue_id", ids)
    .order("created_at", { ascending: true });

  return data.map((row) =>
    mapIssue(
      row as RawIssueRow,
      (eventRows ?? []).filter((e) => e.issue_id === row.id),
    ),
  );
}

/** A single report the signed-in citizen owns — never someone else's, even if public. */
export async function fetchMyIssueById(id: string, userId: string): Promise<Issue | null> {
  if (!supabase) return DEMO_ISSUES.find((issue) => issue.id === id) ?? null;

  const { data: row } = await supabase
    .from("issues")
    .select(ISSUE_COLUMNS)
    .eq("id", id)
    .eq("reporter_id", userId)
    .maybeSingle();

  if (!row) return null;

  const { data: eventRows } = await supabase
    .from("issue_events")
    .select("id, status, note, created_at")
    .eq("issue_id", id)
    .order("created_at", { ascending: true });

  return mapIssue(row as RawIssueRow, (eventRows ?? []) as RawEventRow[]);
}

/** Public issues for the home tab's "nearby reports" list. */
export async function fetchNearbyPublicIssues(limit = 20): Promise<Issue[]> {
  if (!supabase) return DEMO_ISSUES;

  const { data } = await supabase
    .from("issues")
    .select(ISSUE_COLUMNS_WITH_REPORTER)
    .eq("is_public", true)
    .is("deleted_at", null)
    .neq("status", "duplicate")
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data ?? []).map((row) => mapIssue(row as RawIssueRow, []));
}

/** Issue ids the signed-in user has already confirmed, for toggling UI state. */
export async function fetchMyConfirmedIssueIds(userId: string): Promise<Set<string>> {
  if (!supabase) return new Set();
  const { data } = await supabase.from("confirmations").select("issue_id").eq("user_id", userId);
  return new Set((data ?? []).map((row) => row.issue_id as string));
}

/** A citizen confirming a neighbor's report — RLS blocks confirming your own. */
export async function confirmIssue(issueId: string, userId: string): Promise<{ error: string | null }> {
  if (!supabase) return { error: null };
  const { error } = await supabase.from("confirmations").insert({ issue_id: issueId, user_id: userId });
  return { error: error ? error.message : null };
}

export interface CapturedPhoto {
  base64: string;
  contentType: string;
  extension: string;
}

/** Uploads to the same private `issue-media` bucket the web app writes to. */
export async function uploadIssuePhoto(
  userId: string,
  photo: CapturedPhoto,
): Promise<{ storageKey: string; checksum: string } | { error: string }> {
  if (!supabase) return { error: "Supabase is not configured." };

  const storageKey = `${userId}/${Date.now()}.${photo.extension}`;
  const { error } = await supabase.storage
    .from("issue-media")
    .upload(storageKey, decode(photo.base64), { contentType: photo.contentType });

  if (error) return { error: error.message };

  const checksum = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, photo.base64);
  return { storageKey, checksum };
}

export interface CreateIssueInput {
  category: IssueCategory;
  description: string;
  severity: IssueSeverity;
  latitude: number;
  longitude: number;
  neighborhood?: string;
  storageKey?: string | null;
  mimeType?: string | null;
  checksum?: string | null;
}

/**
 * Always goes through the `create_issue` RPC (same one the website uses) so
 * the tracking ID is generated server-side — the device never invents one.
 */
export async function createIssue(
  input: CreateIssueInput,
): Promise<{ trackingId: string } | { error: string }> {
  if (!supabase) {
    return { error: "Reporting isn't available in demo mode — Supabase isn't configured." };
  }

  const { data, error } = await supabase
    .rpc("create_issue", {
      p_category: input.category,
      p_description: input.description,
      p_severity: input.severity,
      p_latitude: input.latitude,
      p_longitude: input.longitude,
      p_accuracy_m: null,
      p_neighborhood: input.neighborhood ?? null,
      p_storage_key: input.storageKey ?? null,
      p_mime_type: input.mimeType ?? null,
      p_checksum: input.checksum ?? null,
    })
    .single();

  if (error || !data) return { error: error?.message ?? "Could not submit the report." };
  return { trackingId: (data as { tracking_id: string }).tracking_id };
}
