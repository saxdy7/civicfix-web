import { decode } from "base64-arraybuffer";
import * as Crypto from "expo-crypto";

import { DEMO_ASSIGNMENTS } from "../demo-data";
import { supabase } from "../supabase";
import type { Assignment, AssignmentStatus, IssueCategory, IssueStatus } from "../types";
import type { CapturedPhoto } from "./issues";

interface RawAssignmentRow {
  id: string;
  issue_id: string;
  due_at: string | null;
  accepted_at: string | null;
  completed_at: string | null;
  issues: {
    category: IssueCategory;
    description: string;
    neighborhood: string | null;
    location: unknown;
    status: IssueStatus;
  } | null;
}

const ASSIGNMENT_COLUMNS =
  "id, issue_id, due_at, accepted_at, completed_at, issues(category, description, neighborhood, location, status)";

function parseLocation(raw: unknown): { latitude: number; longitude: number } {
  if (raw && typeof raw === "object" && Array.isArray((raw as { coordinates?: unknown }).coordinates)) {
    const [lng, lat] = (raw as { coordinates: [number, number] }).coordinates;
    return { latitude: lat, longitude: lng };
  }
  return { latitude: 0, longitude: 0 };
}

function deriveStatus(row: RawAssignmentRow): AssignmentStatus {
  if (row.issues?.status === "resolved") return "resolved";
  if (row.completed_at) return "pending_verification";
  if (row.accepted_at) return "in_progress";
  return "assigned";
}

function mapAssignment(row: RawAssignmentRow): Assignment {
  const { latitude, longitude } = parseLocation(row.issues?.location);
  return {
    id: row.id,
    issueId: row.issue_id,
    issueSummary: row.issues?.description ?? "Assignment",
    category: row.issues?.category ?? "other",
    neighborhood: row.issues?.neighborhood ?? "Unspecified",
    latitude,
    longitude,
    status: deriveStatus(row),
    dueAt: row.due_at,
    beforePhotoCaptured: false,
    afterPhotoCaptured: Boolean(row.completed_at),
  };
}

/** Every assignment for the signed-in field worker, most recently created first. */
export async function fetchMyAssignments(workerId: string): Promise<Assignment[]> {
  if (!supabase) return DEMO_ASSIGNMENTS;

  const { data, error } = await supabase
    .from("assignments")
    .select(ASSIGNMENT_COLUMNS)
    .eq("worker_id", workerId)
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return (data as unknown as RawAssignmentRow[]).map(mapAssignment);
}

export async function fetchAssignmentById(id: string, workerId: string): Promise<Assignment | null> {
  if (!supabase) return DEMO_ASSIGNMENTS.find((a) => a.id === id) ?? null;

  const { data } = await supabase
    .from("assignments")
    .select(ASSIGNMENT_COLUMNS)
    .eq("id", id)
    .eq("worker_id", workerId)
    .maybeSingle();

  if (!data) return null;
  return mapAssignment(data as unknown as RawAssignmentRow);
}

/**
 * Narrowly scoped on purpose: only ever writes `accepted_at`, never worker_id,
 * issue_id, due_at, or assigned_by — those stay under staff/admin control.
 * (Today's RLS technically permits a wider update; this client only ever
 * asks for the one column it needs, and that policy should be tightened to
 * match in a follow-up migration.)
 */
export async function acceptAssignment(
  id: string,
  issueId: string,
  workerId: string,
): Promise<{ error: string | null }> {
  if (!supabase) return { error: null };

  const { error } = await supabase
    .from("assignments")
    .update({ accepted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("worker_id", workerId);
  if (error) return { error: error.message };

  // Same audited RPC the web admin console uses for status changes — never
  // a direct client-side write to issues.status.
  const { error: rpcError } = await supabase.rpc("update_issue_status", {
    p_issue_id: issueId,
    p_next_status: "in_progress",
  });

  return { error: rpcError?.message ?? null };
}

async function uploadEvidencePhoto(
  workerId: string,
  photo: CapturedPhoto,
): Promise<{ storageKey: string; checksum: string } | { error: string }> {
  if (!supabase) return { error: "Supabase is not configured." };
  const storageKey = `${workerId}/evidence-${Date.now()}.${photo.extension}`;
  const { error } = await supabase.storage
    .from("issue-media")
    .upload(storageKey, decode(photo.base64), { contentType: photo.contentType });
  if (error) return { error: error.message };
  const checksum = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, photo.base64);
  return { storageKey, checksum };
}

/**
 * Uploads before/after photos, records them as issue_media, writes
 * resolution_evidence, and marks the assignment's own `completed_at` — all
 * allowed directly under RLS since a field worker is staff acting on their
 * own assignment/evidence rows.
 */
export async function submitResolutionEvidence(params: {
  assignmentId: string;
  issueId: string;
  workerId: string;
  before: CapturedPhoto;
  after: CapturedPhoto;
  note: string;
}): Promise<{ error: string | null }> {
  if (!supabase) return { error: null };

  const [beforeUpload, afterUpload] = await Promise.all([
    uploadEvidencePhoto(params.workerId, params.before),
    uploadEvidencePhoto(params.workerId, params.after),
  ]);

  if ("error" in beforeUpload) return { error: `Before photo: ${beforeUpload.error}` };
  if ("error" in afterUpload) return { error: `After photo: ${afterUpload.error}` };

  const { data: beforeMedia, error: beforeMediaError } = await supabase
    .from("issue_media")
    .insert({
      issue_id: params.issueId,
      storage_key: beforeUpload.storageKey,
      mime_type: params.before.contentType,
      checksum: beforeUpload.checksum,
    })
    .select("id")
    .single();
  if (beforeMediaError || !beforeMedia) return { error: beforeMediaError?.message ?? "Could not save before photo." };

  const { data: afterMedia, error: afterMediaError } = await supabase
    .from("issue_media")
    .insert({
      issue_id: params.issueId,
      storage_key: afterUpload.storageKey,
      mime_type: params.after.contentType,
      checksum: afterUpload.checksum,
    })
    .select("id")
    .single();
  if (afterMediaError || !afterMedia) return { error: afterMediaError?.message ?? "Could not save after photo." };

  const { error: evidenceError } = await supabase.from("resolution_evidence").insert({
    issue_id: params.issueId,
    assignment_id: params.assignmentId,
    before_media_id: beforeMedia.id,
    after_media_id: afterMedia.id,
    note: params.note.trim() || null,
    submitted_by: params.workerId,
  });
  if (evidenceError) return { error: evidenceError.message };

  const { error: assignmentError } = await supabase
    .from("assignments")
    .update({ completed_at: new Date().toISOString() })
    .eq("id", params.assignmentId)
    .eq("worker_id", params.workerId);
  if (assignmentError) return { error: assignmentError.message };

  const { error: statusError } = await supabase.rpc("update_issue_status", {
    p_issue_id: params.issueId,
    p_next_status: "pending_verification",
  });

  return { error: statusError?.message ?? null };
}
