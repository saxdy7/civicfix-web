import * as Crypto from "expo-crypto";

import { DEMO_ISSUES } from "../demo-data";
import { convexClient, convexErrorMessage } from "../convex-client";
import type { Issue, IssueCategory, IssueEvent, IssueSeverity } from "../types";

import { api } from "../../../../convex/_generated/api";
import type { Doc, Id } from "../../../../convex/_generated/dataModel";

function mapEvent(row: Doc<"issueEvents">): IssueEvent {
  return { id: row._id, status: row.status, note: row.note, createdAt: new Date(row.createdAt).toISOString() };
}

function mapIssue(row: Doc<"issues">, events: Doc<"issueEvents">[] = []): Issue {
  return {
    id: row._id,
    trackingId: row.trackingId,
    category: row.category,
    status: row.status,
    severity: row.severity,
    description: row.description,
    neighborhood: row.neighborhood ?? "Unspecified",
    latitude: row.latitude,
    longitude: row.longitude,
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString(),
    events: events.map(mapEvent).sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    reporterId: row.reporterId,
  };
}

/** The signed-in citizen's own reports, newest first. */
export async function fetchMyIssues(_userId: string): Promise<Issue[]> {
  if (!convexClient) return DEMO_ISSUES;
  const rows = await convexClient.query(api.issues.list, { onlyMine: true });
  return rows.map((row) => mapIssue(row));
}

/** A single report the signed-in citizen owns — never someone else's, even if public (Convex enforces this server-side). */
export async function fetchMyIssueById(id: string, _userId: string): Promise<Issue | null> {
  if (!convexClient) return DEMO_ISSUES.find((issue) => issue.id === id) ?? null;
  try {
    const doc = await convexClient.query(api.issues.getById, { issueId: id as Id<"issues"> });
    if (!doc) return null;
    return mapIssue(doc, doc.events);
  } catch {
    return null;
  }
}

/** Public issues for the home tab's "nearby reports" list. */
export async function fetchNearbyPublicIssues(limit = 20): Promise<Issue[]> {
  if (!convexClient) return DEMO_ISSUES;
  const rows = await convexClient.query(api.issues.list, { limit: limit * 2 });
  // Always public-only here, regardless of the viewer's own role — a field
  // worker's Home tab should see the same "nearby civic activity" a citizen
  // would, not every non-public row their staff access happens to unlock.
  return rows
    .filter((row) => row.isPublic && row.status !== "duplicate")
    .slice(0, limit)
    .map((row) => mapIssue(row));
}

export interface CapturedPhoto {
  uri: string;
  base64: string;
  mimeType: string;
}

/**
 * Uploads directly to Convex file storage: get a one-time upload URL, POST
 * the file bytes to it, then link the resulting storage id to the issue.
 * The issue must already exist — Convex's issueMedia.save() requires a real
 * issueId, so this always runs *after* createIssue(), never before.
 */
export async function uploadIssuePhoto(issueId: string, photo: CapturedPhoto): Promise<{ error: string | null }> {
  if (!convexClient) return { error: null };
  try {
    const uploadUrl = await convexClient.mutation(api.issueMedia.generateUploadUrl, {});
    const blob = await (await fetch(photo.uri)).blob();
    const uploadRes = await fetch(uploadUrl, {
      method: "POST",
      headers: { "Content-Type": photo.mimeType },
      body: blob,
    });
    if (!uploadRes.ok) return { error: "Could not upload the photo." };
    const { storageId } = (await uploadRes.json()) as { storageId: Id<"_storage"> };

    const checksum = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, photo.base64);
    await convexClient.mutation(api.issueMedia.save, {
      issueId: issueId as Id<"issues">,
      storageId,
      mimeType: photo.mimeType,
      checksum,
    });
    return { error: null };
  } catch (err) {
    return { error: convexErrorMessage(err) };
  }
}

export interface CreateIssueInput {
  category: IssueCategory;
  description: string;
  severity: IssueSeverity;
  latitude: number;
  longitude: number;
  neighborhood?: string;
}

/**
 * Always goes through the issues.create mutation (same one the website
 * uses) so the tracking ID is generated server-side — the device never
 * invents one.
 */
export async function createIssue(
  input: CreateIssueInput,
): Promise<{ issueId: string; trackingId: string } | { error: string }> {
  if (!convexClient) {
    return { error: "Reporting isn't available in demo mode — Convex isn't configured." };
  }
  try {
    const result = await convexClient.mutation(api.issues.create, input);
    return { issueId: result.id, trackingId: result.trackingId };
  } catch (err) {
    return { error: convexErrorMessage(err) };
  }
}
