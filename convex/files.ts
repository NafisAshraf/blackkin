import { query } from "./_generated/server";
import { v } from "convex/values";
import { r2 } from "./r2";

/**
 * Get a signed serving URL for an R2 object key.
 * Returns null if the file doesn't exist.
 */
export const getUrl = query({
  args: { storageId: v.string() },
  returns: v.union(v.string(), v.null()),
  handler: async (_ctx, args) => {
    return await r2.getUrl(args.storageId);
  },
});

/**
 * Get serving URLs for multiple R2 object keys at once (batch).
 */
export const getUrls = query({
  args: { storageIds: v.array(v.string()) },
  returns: v.array(v.union(v.string(), v.null())),
  handler: async (_ctx, args) => {
    return await Promise.all(
      args.storageIds.map((key) => r2.getUrl(key))
    );
  },
});
