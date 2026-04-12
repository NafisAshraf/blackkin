import { query, mutation } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { Doc } from "./_generated/dataModel";
import { requireAdmin } from "./lib/auth.helpers";
import { getEffectivePrice, isProductVisible } from "./lib/discounts";

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
  effectivePrice: v.number(),
  discountAmount: v.number(),
  discountGroupName: v.union(v.string(), v.null()),
  averageRating: v.number(),
  totalRatings: v.number(),
  imageUrl: v.union(v.string(), v.null()),
});

// Variant card for "People Also Bought" customer display
const alsoBoughtVariantCard = v.object({
  recId: v.id("productRecommendations"),
  variantId: v.id("productVariants"),
  productId: v.id("products"),
  productName: v.string(),
  productSlug: v.string(),
  size: v.string(),
  color: v.optional(v.string()),
  basePrice: v.number(),
  effectivePrice: v.number(),
  discountAmount: v.number(),
  imageUrl: v.union(v.string(), v.null()),
  stock: v.number(),
  sortOrder: v.number(),
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
        if (!row.recommendedProductId) return null;
        const product = await ctx.db.get(row.recommendedProductId);
        if (!product || !isProductVisible(product)) return null;

        const { effectivePrice, discountAmount, discountGroupName } = await getEffectivePrice(ctx, product);
        const firstImage = product.media.find((m) => m.type === "image");
        const imageUrl = firstImage
          ? await ctx.storage.getUrl(firstImage.storageId)
          : null;

        return {
          _id: product._id,
          name: product.name,
          slug: product.slug,
          basePrice: product.basePrice,
          effectivePrice,
          discountAmount,
          discountGroupName,
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
 * "People also bought" — variant-based, shown at checkout.
 * Returns flat list of variant cards matching sizes present in cart.
 * If sizes = [] returns all also_bought variants.
 */
export const getAlsoBought = query({
  args: {
    sizes: v.array(v.string()),
  },
  returns: v.array(alsoBoughtVariantCard),
  handler: async (ctx, args) => {
    const seenVariantIds = new Set<string>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cards: any[] = [];

    let rows: Doc<"productRecommendations">[];
    if (args.sizes.length === 0) {
      rows = await ctx.db
        .query("productRecommendations")
        .withIndex("by_type", (q) => q.eq("type", "also_bought"))
        .take(50);
    } else {
      const allRows: Doc<"productRecommendations">[] = [];
      for (const size of args.sizes) {
        const sizeRecs = await ctx.db
          .query("productRecommendations")
          .withIndex("by_type_and_forSize", (q) =>
            q.eq("type", "also_bought").eq("forSize", size)
          )
          .take(20);
        allRows.push(...sizeRecs);
      }
      rows = allRows;
    }

    // Sort by sortOrder
    rows.sort((a, b) => a.sortOrder - b.sortOrder);

    for (const row of rows) {
      if (!row.recommendedVariantId) continue;
      if (seenVariantIds.has(row.recommendedVariantId)) continue;
      seenVariantIds.add(row.recommendedVariantId);

      const variant = await ctx.db.get(row.recommendedVariantId);
      if (!variant || variant.stock <= 0) continue;

      const product = await ctx.db.get(variant.productId);
      if (!product || !isProductVisible(product)) continue;

      const { effectivePrice, discountAmount } = await getEffectivePrice(ctx, product);
      const firstImage = product.media.find((m) => m.type === "image");
      const imageUrl = firstImage ? await ctx.storage.getUrl(firstImage.storageId) : null;

      cards.push({
        recId: row._id,
        variantId: variant._id,
        productId: product._id,
        productName: product.name,
        productSlug: product.slug,
        size: variant.size,
        color: variant.color,
        basePrice: product.basePrice,
        effectivePrice,
        discountAmount,
        imageUrl,
        stock: variant.stock,
        sortOrder: row.sortOrder,
      });
    }

    return cards;
  },
});

// ─── ADMIN QUERIES ───────────────────────────────────────────

/** Admin: get all "also_like" recommendations sorted */
export const listByType = query({
  args: { type: recType },
  returns: v.array(
    v.object({
      _id: v.id("productRecommendations"),
      _creationTime: v.number(),
      type: recType,
      recommendedProductId: v.optional(v.id("products")),
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
        let productName = "(deleted)";
        if (row.recommendedProductId) {
          const product = await ctx.db.get(row.recommendedProductId);
          productName = product?.name ?? "(deleted)";
        }
        return {
          ...row,
          productName,
        };
      })
    );
  },
});

/**
 * Admin: list "also_bought" variant recommendations grouped by size.
 * Returns an array of { forSize, items[] } where items have enriched variant data.
 */
export const listAlsoBoughtBySize = query({
  args: {},
  returns: v.array(v.object({
    forSize: v.string(),
    items: v.array(v.object({
      _id: v.id("productRecommendations"),
      sortOrder: v.number(),
      variantId: v.id("productVariants"),
      productId: v.id("products"),
      productName: v.string(),
      size: v.string(),
      color: v.optional(v.string()),
      imageUrl: v.union(v.string(), v.null()),
      stock: v.number(),
    })),
  })),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const rows = await ctx.db
      .query("productRecommendations")
      .withIndex("by_type", (q) => q.eq("type", "also_bought"))
      .take(500);

    // Group by size
    const bySize = new Map<string, typeof rows>();
    for (const row of rows) {
      const size = row.forSize ?? "_unknown";
      if (!bySize.has(size)) bySize.set(size, []);
      bySize.get(size)!.push(row);
    }

    const result: { forSize: string; items: any[] }[] = [];

    for (const [forSize, sizeRows] of bySize) {
      const sorted = [...sizeRows].sort((a, b) => a.sortOrder - b.sortOrder);
      const items = await Promise.all(
        sorted.map(async (row) => {
          if (!row.recommendedVariantId) return null;
          const variant = await ctx.db.get(row.recommendedVariantId);
          if (!variant) return null;
          const product = await ctx.db.get(variant.productId);
          if (!product) return null;
          const firstImage = product.media.find((m) => m.type === "image");
          const imageUrl = firstImage ? await ctx.storage.getUrl(firstImage.storageId) : null;
          return {
            _id: row._id,
            sortOrder: row.sortOrder,
            variantId: variant._id,
            productId: product._id,
            productName: product.name,
            size: variant.size,
            color: variant.color,
            imageUrl,
            stock: variant.stock,
          };
        })
      );
      result.push({ forSize, items: items.filter(Boolean) });
    }

    return result;
  },
});

// ─── ADMIN MUTATIONS ─────────────────────────────────────────

/** Admin: add a product recommendation (for also_like) */
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

/** Admin: add a variant recommendation (for also_bought) */
export const addVariant = mutation({
  args: {
    recommendedVariantId: v.id("productVariants"),
    forSize: v.string(),
  },
  returns: v.id("productRecommendations"),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const variant = await ctx.db.get(args.recommendedVariantId);
    if (!variant) throw new ConvexError("Variant not found");

    // Check for duplicate variant in this size section
    const existing = await ctx.db
      .query("productRecommendations")
      .withIndex("by_type_and_forSize", (q) =>
        q.eq("type", "also_bought").eq("forSize", args.forSize)
      )
      .take(200);

    if (existing.some((r) => r.recommendedVariantId === args.recommendedVariantId)) {
      throw new ConvexError("Variant already in this size section");
    }

    const allBought = await ctx.db
      .query("productRecommendations")
      .withIndex("by_type", (q) => q.eq("type", "also_bought"))
      .take(500);
    const maxSort = allBought.length > 0 ? Math.max(...allBought.map((r) => r.sortOrder)) : -1;

    return await ctx.db.insert("productRecommendations", {
      type: "also_bought",
      recommendedVariantId: args.recommendedVariantId,
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

/** Admin: batch reorder recommendations */
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

/** Admin: get variants for a product filtered by size (for variant picker dialog) */
export const getVariantsForPicker = query({
  args: {
    productId: v.id("products"),
    size: v.string(),
  },
  returns: v.array(v.object({
    _id: v.id("productVariants"),
    size: v.string(),
    color: v.optional(v.string()),
    stock: v.number(),
  })),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const variants = await ctx.db
      .query("productVariants")
      .withIndex("by_productId_and_size", (q) =>
        q.eq("productId", args.productId).eq("size", args.size)
      )
      .take(50);
    return variants.map((v) => ({
      _id: v._id,
      size: v.size,
      color: v.color,
      stock: v.stock,
    }));
  },
});
