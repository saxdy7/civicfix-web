import * as Crypto from "expo-crypto";

import { DEMO_ASSIGNMENTS } from "../demo-data";
import { convexClient, convexErrorMessage } from "../convex-client";
import type { Assignment, AssignmentStatus } from "../types";
import type { CapturedPhoto } from "./issues";

import { api } from "../../../../convex/_generated/api";
import type { Doc, Id } from "../../../../convex/_generated/dataModel";

type AssignmentWithIssue = Doc<"assignments"> & { issue: Doc<"issues"> | null };

function deriveStatus(row: AssignmentWithIssue): AssignmentStatus {
  if (row.issue?.status === "resolved") return "resolved";
  if (row.completedAt) return "pending_verification";
  if (row.acceptedAt) return "in_progress";
  return "assigned";
}

function mapAssignment(row: AssignmentWithIssue): Assignment {
  return {
    id: row._id,
    issueId: row.issueId,
    issueSummary: row.issue?.description ?? "Assignment",
    category: row.issue?.category ?? "other",
    neighborhood: row.issue?.neighborhood ?? "Unspecified",
    latitude: row.issue?.latitude ?? 0,
    longitude: row.issue?.longitude ?? 0,
    status: deriveStatus(row),
    dueAt: new Date(row.dueAt).toISOString(),
    beforePhotoCaptured: false,
    afterPhotoCaptured: Boolean(row.completedAt),
  };
}

/** Every assignment for the signed-in field worker, most recently created first. */
export async function fetchMyAssignments(_workerId: string): Promise<Assignment[]> {
  if (!convexClient) return DEMO_ASSIGNMENTS;
  const rows = await convexClient.query(api.assignments.myAssignments, {});
  const withIssues = await Promise.all(
    rows.map(async (row) => ({ ...row, issue: await convexClient.query(api.issues.getById, { issueId: row.issueId }) })),
  );
  return withIssues.sort((a, b) => b.createdAt - a.createdAt).map(mapAssignment);
}

export async function fetchAssignmentById(id: string, _workerId: string): Promise<Assignment | null> {
  if (!convexClient) return DEMO_ASSIGNMENTS.find((a) => a.id === id) ?? null;
  try {
    const row = await convexClient.query(api.assignments.getById, { assignmentId: id as Id<"assignments"> });
    if (!row) return null;
    return mapAssignment(row as AssignmentWithIssue);
  } catch {
    return null;
  }
}

/**
 * A worker accepting their own assignment. The single Convex mutation
 * both patches `acceptedAt` and advances the issue to `in_progress`
 * server-side — narrowly scoped to the caller's own assignment, same as
 * the old RLS-backed pair of writes.
 */
export async function acceptAssignment(id: string, _issueId: string, _workerId: string): Promise<{ error: string | null }> {
  if (!convexClient) return { error: null };
  try {
    await convexClient.mutation(api.assignments.acceptAssignment, { assignmentId: id as Id<"assignments"> });
    return { error: null };
  } catch (err) {
    return { error: convexErrorMessage(err) };
  }
}

async function uploadEvidencePhoto(issueId: string, photo: CapturedPhoto): Promise<{ storageId: string; error?: string }> {
  const uploadUrl = await convexClient!.mutation(api.issueMedia.generateUploadUrl, {});
  const blob = await (await fetch(photo.uri)).blob();
  const uploadRes = await fetch(uploadUrl, { method: "POST", headers: { "Content-Type": photo.mimeType }, body: blob });
  if (!uploadRes.ok) return { storageId: "", error: "Could not upload the photo." };
  const { storageId } = (await uploadRes.json()) as { storageId: string };

  const checksum = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, photo.base64);
  const mediaId = await convexClient!.mutation(api.issueMedia.save, {
    issueId: issueId as Id<"issues">,
    storageId: storageId as Id<"_storage">,
    mimeType: photo.mimeType,
    checksum,
  });
  return { storageId: mediaId };
}

/**
 * Uploads before/after photos as issueMedia, then submits resolutionEvidence
 * in one Convex mutation — which itself marks the assignment's
 * `completedAt` and advances the issue to `pending_verification`
 * server-side (all three used to be four separate Supabase writes).
 */
export async function submitResolutionEvidence(params: {
  assignmentId: string;
  issueId: string;
  workerId: string;
  before: CapturedPhoto;
  after: CapturedPhoto;
  note: string;
}): Promise<{ error: string | null }> {
  if (!convexClient) return { error: null };

  try {
    const [beforeMedia, afterMedia] = await Promise.all([
      uploadEvidencePhoto(params.issueId, params.before),
      uploadEvidencePhoto(params.issueId, params.after),
    ]);
    if (beforeMedia.error) return { error: `Before photo: ${beforeMedia.error}` };
    if (afterMedia.error) return { error: `After photo: ${afterMedia.error}` };

    await convexClient.mutation(api.resolutionEvidence.submit, {
      issueId: params.issueId as Id<"issues">,
      assignmentId: params.assignmentId as Id<"assignments">,
      beforeMediaId: beforeMedia.storageId as Id<"issueMedia">,
      afterMediaId: afterMedia.storageId as Id<"issueMedia">,
      note: params.note.trim() || undefined,
    });
    return { error: null };
  } catch (err) {
    return { error: convexErrorMessage(err) };
  }
}
