import { query, mutation } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { Doc } from "./_generated/dataModel";
import { requireAdmin } from "./lib/auth.helpers";
import { getProductDiscountedPrice } from "./lib/discounts";

// ─── Validators ─────────────────────────────────────────────

const recType = v.union(
  v.literal("also_like"),
  v.literal("also_bought")
);

const recommendedProductCard = v.object({
  _id: v.id("products"),
  name: v.string(),
  slug: v.string(),
  basePrice: v.number(),
  discountedPrice: v.number(),
  averageRating: v.number(),
  totalRatings: v.number(),
  imageUrl: v.union(v.string(), v.null()),
});

// ─── PUBLIC QUERIES ──────────────────────────────────────────

/** "You may also like" — shown on ALL product detail pages */
export const getAlsoLike = query({
  args: {},
  returns: v.array(recommendedProductCard),
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("productRecommendations")
      .withIndex("by_type", (q) => q.eq("type", "also_like"))
      .order("asc")
      .take(20);

    const cards = await Promise.all(
      rows.map(async (row) => {
        const product = await ctx.db.get(row.recommendedProductId);
        if (!product || !product.isActive) return null;

        const { discountedPrice } = await getProductDiscountedPrice(ctx, product);
        const firstImage = product.media.find((m) => m.type === "image");
        const imageUrl = firstImage
          ? await ctx.storage.getUrl(firstImage.storageId)
          : null;

        return {
          _id: product._id,
          name: product.name,
          slug: product.slug,
          basePrice: product.basePrice,
          discountedPrice,
          averageRating: product.averageRating,
          totalRatings: product.totalRatings,
          imageUrl,
        };
      })
    );

    return cards.filter(Boolean) as NonNullable<(typeof cards)[0]>[];
  },
});

/**
 * "People also bought" — shown at checkout.
 * Filtered by the sizes present in the cart.
 * If sizes = [] returns storewide (forSize = null) recommendations.
 */
export const getAlsoBought = query({
  args: {
    sizes: v.array(v.string()),
  },
  returns: v.array(recommendedProductCard),
  handler: async (ctx, args) => {
    const matchedProductIds = new Set<string>();
    const rows: Doc<"productRecommendations">[] = [];

    if (args.sizes.length === 0) {
      const generic = await ctx.db
        .query("productRecommendations")
        .withIndex("by_type_and_forSize", (q) =>
          q.eq("type", "also_bought").eq("forSize", undefined)
        )
        .take(20);
      rows.push(...generic);
    } else {
      for (const size of args.sizes) {
        const sizeRecs = await ctx.db
          .query("productRecommendations")
          .withIndex("by_type_and_forSize", (q) =>
            q.eq("type", "also_bought").eq("forSize", size)
          )
          .take(20);
        rows.push(...sizeRecs);
      }
    }

    const cards = await Promise.all(
      rows
        .filter((row) => {
          const id = row.recommendedProductId;
          if (matchedProductIds.has(id)) return false;
          matchedProductIds.add(id);
          return true;
        })
        .map(async (row) => {
          const product = await ctx.db.get(row.recommendedProductId);
          if (!product || !product.isActive) return null;

          const { discountedPrice } = await getProductDiscountedPrice(ctx, product);
          const firstImage = product.media.find((m) => m.type === "image");
          const imageUrl = firstImage
            ? await ctx.storage.getUrl(firstImage.storageId)
            : null;

          return {
            _id: product._id,
            name: product.name,
            slug: product.slug,
            basePrice: product.basePrice,
            discountedPrice,
            averageRating: product.averageRating,
            totalRatings: product.totalRatings,
            imageUrl,
          };
        })
    );

    return cards.filter(Boolean) as NonNullable<(typeof cards)[0]>[];
  },
});

// ─── ADMIN QUERIES ───────────────────────────────────────────

/** Admin: get all recommendations of a type, sorted by sortOrder */
export const listByType = query({
  args: { type: recType },
  returns: v.array(
    v.object({
      _id: v.id("productRecommendations"),
      _creationTime: v.number(),
      type: recType,
      recommendedProductId: v.id("products"),
      forSize: v.optional(v.string()),
      sortOrder: v.number(),
      productName: v.string(),
    })
  ),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const rows = await ctx.db
      .query("productRecommendations")
      .withIndex("by_type", (q) => q.eq("type", args.type))
      .take(200);

    const sorted = [...rows].sort((a, b) => a.sortOrder - b.sortOrder);

    return await Promise.all(
      sorted.map(async (row) => {
        const product = await ctx.db.get(row.recommendedProductId);
        return {
          ...row,
          productName: product?.name ?? "(deleted)",
        };
      })
    );
  },
});

// ─── ADMIN MUTATIONS ─────────────────────────────────────────

/** Admin: add a recommendation (for also_like / also_bought — appends at bottom) */
export const add = mutation({
  args: {
    type: recType,
    recommendedProductId: v.id("products"),
    forSize: v.optional(v.string()),
  },
  returns: v.id("productRecommendations"),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const product = await ctx.db.get(args.recommendedProductId);
    if (!product) throw new ConvexError("Product not found");

    // Check for duplicate in same type
    const existing = await ctx.db
      .query("productRecommendations")
      .withIndex("by_type", (q) => q.eq("type", args.type))
      .take(200);
    if (existing.some((r) => r.recommendedProductId === args.recommendedProductId)) {
      throw new ConvexError("Product already in this section");
    }

    const maxSort = existing.length > 0 ? Math.max(...existing.map((r) => r.sortOrder)) : -1;
    return await ctx.db.insert("productRecommendations", {
      type: args.type,
      recommendedProductId: args.recommendedProductId,
      forSize: args.forSize,
      sortOrder: maxSort + 1,
    });
  },
});

/** Admin: remove a recommendation by ID */
export const remove = mutation({
  args: { id: v.id("productRecommendations") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.delete(args.id);
    return null;
  },
});

/** Admin: batch reorder recommendations (single mutation for cost efficiency) */
export const reorder = mutation({
  args: {
    items: v.array(
      v.object({ id: v.id("productRecommendations"), sortOrder: v.number() })
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await Promise.all(
      args.items.map((item) => ctx.db.patch(item.id, { sortOrder: item.sortOrder }))
    );
    return null;
  },
});
