import { v, ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUser } from "./lib/auth";

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
    return await ctx.storage.getUrl(media.storageId);
  },
});
