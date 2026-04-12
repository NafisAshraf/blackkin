import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requirePermission } from "./lib/auth.helpers";

// Admin: get settings for a specific type
export const getSettings = query({
  args: { type: v.union(v.literal("facebook"), v.literal("google"), v.literal("seo"), v.literal("customScripts")) },
  returns: v.any(),
  handler: async (ctx, args) => {
    await requirePermission(ctx, "marketing");
    const doc = await ctx.db.query("marketingSettings").withIndex("by_type", q => q.eq("type", args.type)).unique();
    return doc?.config ?? null;
  },
});

// Admin: upsert settings for a specific type
export const upsertSettings = mutation({
  args: {
    type: v.union(v.literal("facebook"), v.literal("google"), v.literal("seo"), v.literal("customScripts")),
    config: v.any(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requirePermission(ctx, "marketing");
    const existing = await ctx.db.query("marketingSettings").withIndex("by_type", q => q.eq("type", args.type)).unique();
    if (existing) {
      await ctx.db.patch(existing._id, { config: args.config });
    } else {
      await ctx.db.insert("marketingSettings", { type: args.type, config: args.config });
    }
    return null;
  },
});

// PUBLIC: returns only safe-to-expose fields for storefront pixel injection
// Never returns access tokens
export const getPublicSettings = query({
  args: {},
  returns: v.object({
    facebookPixelId: v.union(v.string(), v.null()),
    facebookBrowserEnabled: v.boolean(),
    ga4MeasurementId: v.union(v.string(), v.null()),
    googleEnabled: v.boolean(),
    headScripts: v.union(v.string(), v.null()),
    bodyScripts: v.union(v.string(), v.null()),
  }),
  handler: async (ctx) => {
    const [fbDoc, googleDoc, scriptsDoc] = await Promise.all([
      ctx.db.query("marketingSettings").withIndex("by_type", q => q.eq("type", "facebook")).unique(),
      ctx.db.query("marketingSettings").withIndex("by_type", q => q.eq("type", "google")).unique(),
      ctx.db.query("marketingSettings").withIndex("by_type", q => q.eq("type", "customScripts")).unique(),
    ]);
    const fb = fbDoc?.config as { pixelId?: string; browserEnabled?: boolean } | null;
    const google = googleDoc?.config as { ga4MeasurementId?: string; enabled?: boolean } | null;
    const scripts = scriptsDoc?.config as { headScripts?: string; bodyScripts?: string } | null;
    return {
      facebookPixelId: fb?.pixelId ?? null,
      facebookBrowserEnabled: fb?.browserEnabled ?? false,
      ga4MeasurementId: google?.ga4MeasurementId ?? null,
      googleEnabled: google?.enabled ?? false,
      headScripts: scripts?.headScripts ?? null,
      bodyScripts: scripts?.bodyScripts ?? null,
    };
  },
});
