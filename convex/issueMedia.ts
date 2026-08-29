import { v, ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";
import { isStaff, requireUser } from "./lib/auth";

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "image/heic"];

/** Client calls this first, uploads the file bytes directly to the returned URL, then calls save() with the resulting storageId. */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireUser(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

export const save = mutation({
  args: {
    issueId: v.id("issues"),
    storageId: v.id("_storage"),
    mimeType: v.string(),
    checksum: v.string(),
    sizeBytes: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    if (!ALLOWED_MIME.includes(args.mimeType)) throw new ConvexError("Unsupported image type");
    if (args.sizeBytes !== undefined && args.sizeBytes > MAX_BYTES) throw new ConvexError("Photo must be under 10 MB");

    const issue = await ctx.db.get(args.issueId);
    if (!issue || issue.deletedAt) throw new ConvexError("Target issue not found");

    const staff = await isStaff(ctx, user._id);
    const isReporter = issue.reporterId === user._id;

    if (!isReporter && !staff) {
      throw new ConvexError("Not authorized to attach media to another user's issue");
    }

    return await ctx.db.insert("issueMedia", {
      issueId: args.issueId,
      storageId: args.storageId,
      mimeType: args.mimeType,
      checksum: args.checksum,
      uploadedBy: user._id,
      createdAt: Date.now(),
    });
  },
});

export const getUrl = query({
  args: { mediaId: v.id("issueMedia") },
  handler: async (ctx, args) => {
    const media = await ctx.db.get(args.mediaId);
    if (!media) return null;

    const issue = await ctx.db.get(media.issueId);
    if (!issue || issue.deletedAt) return null;

    // Public issues can have their media viewed by anyone.
    if (issue.isPublic) {
      return await ctx.storage.getUrl(media.storageId);
    }

    // Private issues require the reporter or an authorized staff member.
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const viewer = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!viewer) return null;

    const staff = await isStaff(ctx, viewer._id);
    if (issue.reporterId !== viewer._id && !staff) {
      return null;
    }

    return await ctx.storage.getUrl(media.storageId);
  },
});

export const listForIssue = query({
  args: { issueId: v.id("issues") },
  handler: async (ctx, args) => {
    const issue = await ctx.db.get(args.issueId);
    if (!issue || issue.deletedAt) return [];

    if (!issue.isPublic) {
      const identity = await ctx.auth.getUserIdentity();
      if (!identity) return [];
      const viewer = await ctx.db
        .query("users")
        .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
        .unique();
      if (!viewer) return [];
      const staff = await isStaff(ctx, viewer._id);
      if (issue.reporterId !== viewer._id && !staff) return [];
    }

    return await ctx.db
      .query("issueMedia")
      .withIndex("by_issue", (q) => q.eq("issueId", args.issueId))
      .collect();
  },
});
