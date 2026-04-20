import { ConvexError, v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { mutation, query, MutationCtx, QueryCtx } from "./_generated/server";
import { requireAdmin } from "./lib/auth.helpers";
import { getEffectivePrice, isProductVisible } from "./lib/discounts";
import { r2 } from "./r2";

// ─── Slot union (reused in args validators) ────────────────────────────────
const slotValidator = v.union(
  v.literal("hero"),
  v.literal("splitImage"),
  v.literal("tech1"),
  v.literal("tech2"),
  v.literal("tech3"),
);

const landingPageSectionPosition = v.union(v.literal(1), v.literal(2));

async function resolveLandingSectionProducts(
  ctx: QueryCtx | MutationCtx,
  sectionId: Id<"landingPageProductSections">,
) {
  const items = await ctx.db
    .query("landingPageProductSectionItems")
    .withIndex("by_sectionId_and_sortOrder", (q) =>
      q.eq("sectionId", sectionId),
    )
    .collect();

  const products = (
    await Promise.all(
      items.map(async (item) => {
        const product = await ctx.db.get(item.productId);
        if (!product) return null;

        const firstMedia = [...product.media]
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .find((media) => media.type === "image");
        const imageUrl = firstMedia
          ? await r2.getUrl(firstMedia.storageId)
          : null;

        return {
          _id: item._id,
          productId: product._id,
          name: product.name,
          slug: product.slug,
          imageUrl,
          sortOrder: item.sortOrder,
        };
      }),
    )
  ).filter(
    (product): product is NonNullable<typeof product> => product !== null,
  );

  products.sort((a, b) => a.sortOrder - b.sortOrder);
  return products;
}

async function deleteLandingSectionItems(
  ctx: MutationCtx,
  sectionId: Id<"landingPageProductSections">,
) {
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
}

// ─── PUBLIC QUERY (used by SSR on the landing page) ────────────────────────
/**
 * Returns resolved image URLs (null = slot not configured → use static fallback)
 * and all active quotes in insertion order.
 */
export const getContent = query({
  args: {},
  handler: async (ctx) => {
    const slots = ["hero", "splitImage", "tech1", "tech2", "tech3"] as const;

    const imageEntries = await Promise.all(
      slots.map(async (slot) => {
        const row = await ctx.db
          .query("landingPageImages")
          .withIndex("by_slot", (q) => q.eq("slot", slot))
          .first();
        const url = row ? await r2.getUrl(row.storageId) : null;
        return [slot, url] as const;
      }),
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

    activeSections.sort((a, b) => a.position - b.position);

    const productSections = await Promise.all(
      activeSections.map(async (section) => {
        const items = await ctx.db
          .query("landingPageProductSectionItems")
          .withIndex("by_sectionId_and_sortOrder", (q) =>
            q.eq("sectionId", section._id),
          )
          .collect();

        // Resolve each product with its details
        const products = (
          await Promise.all(
            items.map(async (item) => {
              const product = await ctx.db.get(item.productId);
              if (!product || !isProductVisible(product)) return null;

              const { effectivePrice, discountAmount, discountGroupName } =
                await getEffectivePrice(ctx, product);

              // Resolve first image URL
              const firstMedia = [...product.media]
                .sort((a, b) => a.sortOrder - b.sortOrder)
                .find((m) => m.type === "image");
              const imageUrl = firstMedia
                ? await r2.getUrl(firstMedia.storageId)
                : null;

              // Get unique variant colors
              const variants = await ctx.db
                .query("productVariants")
                .withIndex("by_productId", (q) =>
                  q.eq("productId", product._id),
                )
                .take(50);
              const colors = [
                ...new Set(
                  variants.map((v) => v.color).filter((c): c is string => !!c),
                ),
              ];

              return {
                _id: product._id,
                name: product.name,
                slug: product.slug,
                basePrice: product.basePrice,
                effectivePrice,
                discountAmount,
                discountGroupName,
                imageUrl,
                colors,
                sortOrder: item.sortOrder,
              };
            }),
          )
        ).filter((p): p is NonNullable<typeof p> => p !== null);

        // Sort by sortOrder
        products.sort((a, b) => a.sortOrder - b.sortOrder);

        return {
          position: section.position,
          heading: section.heading,
          products,
        };
      }),
    );

    return {
      images,
      quotes,
      productSections: productSections.filter(
        (section) => section.products.length > 0,
      ),
    };
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
        url: await r2.getUrl(row.storageId),
      })),
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
    storageId: v.string(),
  },
  handler: async (ctx, { slot, storageId }) => {
    await requireAdmin(ctx);
    const existing = await ctx.db
      .query("landingPageImages")
      .withIndex("by_slot", (q) => q.eq("slot", slot))
      .first();
    if (existing) {
      const oldKey = existing.storageId;
      await ctx.db.patch(existing._id, { storageId });
      // Delete the old R2 object now that it's been replaced
      if (oldKey !== storageId) {
        await r2.deleteObject(ctx, oldKey);
      }
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
        const products = await resolveLandingSectionProducts(ctx, section._id);

        sections.push({
          _id: section._id,
          position: section.position,
          heading: section.heading,
          isActive: section.isActive,
          products,
        });
      } else {
        sections.push({
          _id: null,
          position: pos,
          heading: "",
          isActive: false,
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
    position: landingPageSectionPosition,
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
    if (!section.isActive) {
      const items = await ctx.db
        .query("landingPageProductSectionItems")
        .withIndex("by_sectionId", (q) => q.eq("sectionId", id))
        .take(1);
      if (items.length === 0) {
        throw new ConvexError(
          "Add at least one product before showing this section",
        );
      }
    }
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
      }),
    ),
  },
  handler: async (ctx, { items }) => {
    await requireAdmin(ctx);
    await Promise.all(
      items.map(({ id, sortOrder }) => ctx.db.patch(id, { sortOrder })),
    );
  },
});

// ─── ADMIN MUTATION — add a product to a section ─────────────────────────────
export const addProductToSection = mutation({
  args: {
    sectionId: v.id("landingPageProductSections"),
    productId: v.id("products"),
  },
  returns: v.null(),
  handler: async (ctx, { sectionId, productId }) => {
    await requireAdmin(ctx);

    const section = await ctx.db.get(sectionId);
    if (!section) throw new ConvexError("Section not found");

    const product = await ctx.db.get(productId);
    if (!product) throw new ConvexError("Product not found");

    const existingItem = await ctx.db
      .query("landingPageProductSectionItems")
      .withIndex("by_sectionId_and_productId", (q) =>
        q.eq("sectionId", sectionId).eq("productId", productId),
      )
      .first();
    if (existingItem) {
      throw new ConvexError("Product already in this section");
    }

    const items = await ctx.db
      .query("landingPageProductSectionItems")
      .withIndex("by_sectionId", (q) => q.eq("sectionId", sectionId))
      .collect();
    const maxSort = items.reduce(
      (max, item) => Math.max(max, item.sortOrder),
      -1,
    );

    await ctx.db.insert("landingPageProductSectionItems", {
      sectionId,
      productId,
      sortOrder: maxSort + 1,
    });
    return null;
  },
});

// ─── ADMIN MUTATION — remove a product from a section ────────────────────────
export const removeProductFromSection = mutation({
  args: {
    itemId: v.id("landingPageProductSectionItems"),
  },
  returns: v.null(),
  handler: async (ctx, { itemId }) => {
    await requireAdmin(ctx);

    const item = await ctx.db.get(itemId);
    if (!item) throw new ConvexError("Section product not found");

    await ctx.db.delete(itemId);

    const remaining = await ctx.db
      .query("landingPageProductSectionItems")
      .withIndex("by_sectionId", (q) => q.eq("sectionId", item.sectionId))
      .take(1);
    if (remaining.length === 0) {
      await ctx.db.patch(item.sectionId, { isActive: false });
    }

    return null;
  },
});

// ─── ADMIN MUTATION — clear a section and hide it ───────────────────────────
export const clearSection = mutation({
  args: {
    sectionId: v.id("landingPageProductSections"),
  },
  returns: v.null(),
  handler: async (ctx, { sectionId }) => {
    await requireAdmin(ctx);

    const section = await ctx.db.get(sectionId);
    if (!section) throw new ConvexError("Section not found");

    await ctx.db.patch(sectionId, { isActive: false });
    await deleteLandingSectionItems(ctx, sectionId);
    return null;
  },
});
