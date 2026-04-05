import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAdmin } from "./lib/auth.helpers";

// ─── Slot union (reused in args validators) ────────────────────────────────
const slotValidator = v.union(
  v.literal("hero"),
  v.literal("lifestyleBanner"),
  v.literal("splitImage"),
  v.literal("tech1"),
  v.literal("tech2"),
  v.literal("tech3")
);

// ─── PUBLIC QUERY (used by SSR on the landing page) ────────────────────────
/**
 * Returns resolved image URLs (null = slot not configured → use static fallback)
 * and all active quotes in insertion order.
 */
export const getContent = query({
  args: {},
  handler: async (ctx) => {
    const slots = [
      "hero",
      "lifestyleBanner",
      "splitImage",
      "tech1",
      "tech2",
      "tech3",
    ] as const;

    const imageEntries = await Promise.all(
      slots.map(async (slot) => {
        const row = await ctx.db
          .query("landingPageImages")
          .withIndex("by_slot", (q) => q.eq("slot", slot))
          .first();
        const url = row ? await ctx.storage.getUrl(row.storageId) : null;
        return [slot, url] as const;
      })
    );

    const images = Object.fromEntries(imageEntries) as Record<
      (typeof slots)[number],
      string | null
    >;

    const quotes = await ctx.db
      .query("landingPageQuotes")
      .withIndex("by_isActive", (q) => q.eq("isActive", true))
      .collect();

    return { images, quotes };
  },
});

// ─── ADMIN QUERY — all image slots ─────────────────────────────────────────
/**
 * Returns every configured slot with its current URL so the admin CMS
 * can show a preview. Returns only rows that have been saved.
 */
export const adminGetImages = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const rows = await ctx.db.query("landingPageImages").collect();
    return await Promise.all(
      rows.map(async (row) => ({
        slot: row.slot,
        storageId: row.storageId,
        url: await ctx.storage.getUrl(row.storageId),
      }))
    );
  },
});

// ─── ADMIN QUERY — all quotes ───────────────────────────────────────────────
/**
 * Returns all quotes (active + inactive) ordered by creation time asc.
 * Used by the admin CMS quote management table.
 */
export const adminGetAllQuotes = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return await ctx.db.query("landingPageQuotes").order("asc").collect();
  },
});

// ─── ADMIN MUTATION — upsert image slot ────────────────────────────────────
/**
 * Saves (or replaces) a storageId for the given landing-page image slot.
 * Idempotent: subsequent calls replace the previous storageId.
 */
export const updateImage = mutation({
  args: {
    slot: slotValidator,
    storageId: v.id("_storage"),
  },
  handler: async (ctx, { slot, storageId }) => {
    await requireAdmin(ctx);
    const existing = await ctx.db
      .query("landingPageImages")
      .withIndex("by_slot", (q) => q.eq("slot", slot))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { storageId });
    } else {
      await ctx.db.insert("landingPageImages", { slot, storageId });
    }
  },
});

// ─── ADMIN MUTATION — add quote ────────────────────────────────────────────
export const addQuote = mutation({
  args: {
    text: v.string(),
    author: v.string(),
  },
  handler: async (ctx, { text, author }) => {
    await requireAdmin(ctx);
    await ctx.db.insert("landingPageQuotes", { text, author, isActive: true });
  },
});

// ─── ADMIN MUTATION — update quote text/author ─────────────────────────────
export const updateQuote = mutation({
  args: {
    id: v.id("landingPageQuotes"),
    text: v.string(),
    author: v.string(),
  },
  handler: async (ctx, { id, text, author }) => {
    await requireAdmin(ctx);
    const quote = await ctx.db.get(id);
    if (!quote) throw new ConvexError("Quote not found");
    await ctx.db.patch(id, { text, author });
  },
});

// ─── ADMIN MUTATION — toggle quote active/inactive ─────────────────────────
export const toggleQuoteActive = mutation({
  args: { id: v.id("landingPageQuotes") },
  handler: async (ctx, { id }) => {
    await requireAdmin(ctx);
    const quote = await ctx.db.get(id);
    if (!quote) throw new ConvexError("Quote not found");
    await ctx.db.patch(id, { isActive: !quote.isActive });
  },
});

// ─── ADMIN MUTATION — delete quote ─────────────────────────────────────────
export const deleteQuote = mutation({
  args: { id: v.id("landingPageQuotes") },
  handler: async (ctx, { id }) => {
    await requireAdmin(ctx);
    const quote = await ctx.db.get(id);
    if (!quote) throw new ConvexError("Quote not found");
    await ctx.db.delete(id);
  },
});
