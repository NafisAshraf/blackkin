import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAdmin } from "./lib/auth.helpers";
import { getProductDiscountedPrice } from "./lib/discounts";

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

    // ── Product Showcase Sections ──────────────────────────────
    const activeSections = await ctx.db
      .query("landingPageProductSections")
      .withIndex("by_isActive", (q) => q.eq("isActive", true))
      .collect();

    const productSections = await Promise.all(
      activeSections.map(async (section) => {
        const items = await ctx.db
          .query("landingPageProductSectionItems")
          .withIndex("by_sectionId_and_sortOrder", (q) =>
            q.eq("sectionId", section._id)
          )
          .collect();

        // Resolve each product with its details
        const products = (
          await Promise.all(
            items.map(async (item) => {
              const product = await ctx.db.get(item.productId);
              if (!product || !product.isActive) return null;

              const { discountedPrice, discountAmount, campaignName } =
                await getProductDiscountedPrice(ctx, product);

              // Resolve first image URL
              const firstMedia = [...product.media]
                .sort((a, b) => a.sortOrder - b.sortOrder)
                .find((m) => m.type === "image");
              const imageUrl = firstMedia
                ? await ctx.storage.getUrl(firstMedia.storageId)
                : null;

              // Get unique variant colors
              const variants = await ctx.db
                .query("productVariants")
                .withIndex("by_productId", (q) =>
                  q.eq("productId", product._id)
                )
                .take(50);
              const colors = [
                ...new Set(
                  variants
                    .map((v) => v.color)
                    .filter((c): c is string => !!c)
                ),
              ];

              return {
                _id: product._id,
                name: product.name,
                slug: product.slug,
                basePrice: product.basePrice,
                discountedPrice,
                discountAmount,
                campaignName,
                imageUrl,
                colors,
                sortOrder: item.sortOrder,
              };
            })
          )
        ).filter(
          (p): p is NonNullable<typeof p> => p !== null
        );

        // Sort by sortOrder
        products.sort((a, b) => a.sortOrder - b.sortOrder);

        return {
          position: section.position,
          heading: section.heading,
          products,
        };
      })
    );

    return { images, quotes, productSections };
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

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ─── PRODUCT SHOWCASE SECTIONS ─────────────────────────────
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// ─── ADMIN QUERY — get both product sections with items ────────────────────
export const adminGetProductSections = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);

    // Always return both positions (1 and 2), creating placeholders if missing
    const sections = [];
    for (const pos of [1, 2] as const) {
      const section = await ctx.db
        .query("landingPageProductSections")
        .withIndex("by_position", (q) => q.eq("position", pos))
        .first();

      if (section) {
        const items = await ctx.db
          .query("landingPageProductSectionItems")
          .withIndex("by_sectionId_and_sortOrder", (q) =>
            q.eq("sectionId", section._id)
          )
          .collect();

        // Resolve product names for display in admin
        const products = (
          await Promise.all(
            items.map(async (item) => {
              const product = await ctx.db.get(item.productId);
              if (!product) return null;

              // Resolve first image
              const firstMedia = [...product.media]
                .sort((a, b) => a.sortOrder - b.sortOrder)
                .find((m) => m.type === "image");
              const imageUrl = firstMedia
                ? await ctx.storage.getUrl(firstMedia.storageId)
                : null;

              return {
                _id: item._id,
                productId: product._id,
                name: product.name,
                slug: product.slug,
                imageUrl,
                sortOrder: item.sortOrder,
              };
            })
          )
        ).filter(
          (p): p is NonNullable<typeof p> => p !== null
        );

        products.sort((a, b) => a.sortOrder - b.sortOrder);

        const tagName = section.tagId
          ? (await ctx.db.get(section.tagId))?.name ?? null
          : null;

        sections.push({
          _id: section._id,
          position: section.position,
          heading: section.heading,
          isActive: section.isActive,
          tagId: section.tagId ?? null,
          tagName,
          products,
        });
      } else {
        sections.push({
          _id: null,
          position: pos,
          heading: "",
          isActive: false,
          tagId: null,
          tagName: null,
          products: [],
        });
      }
    }

    return sections;
  },
});

// ─── ADMIN MUTATION — upsert product section heading ───────────────────────
export const upsertProductSection = mutation({
  args: {
    position: v.union(v.literal(1), v.literal(2)),
    heading: v.string(),
  },
  handler: async (ctx, { position, heading }) => {
    await requireAdmin(ctx);

    const existing = await ctx.db
      .query("landingPageProductSections")
      .withIndex("by_position", (q) => q.eq("position", position))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { heading });
      return existing._id;
    } else {
      return await ctx.db.insert("landingPageProductSections", {
        position,
        heading,
        isActive: false,
      });
    }
  },
});

// ─── ADMIN MUTATION — toggle product section active ────────────────────────
export const toggleProductSection = mutation({
  args: { id: v.id("landingPageProductSections") },
  handler: async (ctx, { id }) => {
    await requireAdmin(ctx);
    const section = await ctx.db.get(id);
    if (!section) throw new ConvexError("Section not found");
    await ctx.db.patch(id, { isActive: !section.isActive });
  },
});

// ─── ADMIN MUTATION — reorder products in section ─────────────────────────
export const reorderSectionProducts = mutation({
  args: {
    items: v.array(
      v.object({
        id: v.id("landingPageProductSectionItems"),
        sortOrder: v.number(),
      })
    ),
  },
  handler: async (ctx, { items }) => {
    await requireAdmin(ctx);
    await Promise.all(
      items.map(({ id, sortOrder }) => ctx.db.patch(id, { sortOrder }))
    );
  },
});

// ─── ADMIN MUTATION — set tag for section (populates items from tag) ─────────
export const setTagForSection = mutation({
  args: {
    sectionId: v.id("landingPageProductSections"),
    tagId: v.id("tags"),
  },
  returns: v.null(),
  handler: async (ctx, { sectionId, tagId }) => {
    await requireAdmin(ctx);

    const section = await ctx.db.get(sectionId);
    if (!section) throw new ConvexError("Section not found");

    const tag = await ctx.db.get(tagId);
    if (!tag) throw new ConvexError("Tag not found");

    // Clear all existing items
    let clearDone = false;
    while (!clearDone) {
      const existingItems = await ctx.db
        .query("landingPageProductSectionItems")
        .withIndex("by_sectionId", (q) => q.eq("sectionId", sectionId))
        .take(64);
      if (existingItems.length === 0) {
        clearDone = true;
      } else {
        await Promise.all(existingItems.map((item) => ctx.db.delete(item._id)));
      }
    }

    // Set the new tag
    await ctx.db.patch(sectionId, { tagId });

    // Populate items from products with this tag (capped at 50 for transaction safety)
    const productTagRows = await ctx.db
      .query("productTags")
      .withIndex("by_tagId", (q) => q.eq("tagId", tagId))
      .take(50);

    // Deduplicate by productId (guard against duplicate productTags rows)
    const seenProductIds = new Set<string>();
    const uniqueProductTagRows = productTagRows.filter((pt) => {
      if (seenProductIds.has(pt.productId)) return false;
      seenProductIds.add(pt.productId);
      return true;
    });

    await Promise.all(
      uniqueProductTagRows.map((pt, index) =>
        ctx.db.insert("landingPageProductSectionItems", {
          sectionId,
          productId: pt.productId,
          sortOrder: index,
        })
      )
    );
    return null;
  },
});

// ─── ADMIN MUTATION — clear tag and all items from section ───────────────────
export const clearSection = mutation({
  args: {
    sectionId: v.id("landingPageProductSections"),
  },
  returns: v.null(),
  handler: async (ctx, { sectionId }) => {
    await requireAdmin(ctx);

    const section = await ctx.db.get(sectionId);
    if (!section) throw new ConvexError("Section not found");

    // Remove tag and hide the section
    await ctx.db.patch(sectionId, { tagId: undefined, isActive: false });

    // Delete all items
    let clearDone = false;
    while (!clearDone) {
      const items = await ctx.db
        .query("landingPageProductSectionItems")
        .withIndex("by_sectionId", (q) => q.eq("sectionId", sectionId))
        .take(64);
      if (items.length === 0) {
        clearDone = true;
      } else {
        await Promise.all(items.map((item) => ctx.db.delete(item._id)));
      }
    }
    return null;
  },
});
