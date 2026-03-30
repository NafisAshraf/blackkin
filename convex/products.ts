import { query, mutation } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { requireAdmin } from "./lib/auth.helpers";
import { aggregateProducts } from "./lib/aggregates";
import { getProductDiscountedPrice } from "./lib/discounts";
import { Doc, Id } from "./_generated/dataModel";

// ─── SHARED VALIDATORS ─────────────────────────────────────

const mediaItemValidator = v.object({
  storageId: v.id("_storage"),
  type: v.union(v.literal("image"), v.literal("video")),
  sortOrder: v.number(),
});

const variantValidator = v.object({
  _id: v.id("productVariants"),
  _creationTime: v.number(),
  productId: v.id("products"),
  size: v.string(),
  color: v.optional(v.string()),
  sku: v.optional(v.string()),
  stock: v.number(),
  priceOverride: v.optional(v.number()),
});

const productWithPricingValidator = v.object({
  _id: v.id("products"),
  _creationTime: v.number(),
  name: v.string(),
  slug: v.string(),
  description: v.string(),
  categoryId: v.id("categories"),
  basePrice: v.number(),
  discountedPrice: v.number(),
  discountAmount: v.number(),
  campaignName: v.union(v.string(), v.null()),
  isActive: v.boolean(),
  totalRatings: v.number(),
  averageRating: v.number(),
  media: v.array(mediaItemValidator),
  tags: v.array(v.object({ _id: v.id("tags"), name: v.string(), slug: v.string() })),
  variants: v.array(variantValidator),
});

// ─── HELPERS ───────────────────────────────────────────────

async function enrichProduct(ctx: any, product: Doc<"products">) {
  const { discountedPrice, discountAmount, campaignName } =
    await getProductDiscountedPrice(ctx, product);

  const productTagRows = await ctx.db
    .query("productTags")
    .withIndex("by_productId", (q: any) => q.eq("productId", product._id))
    .take(50);

  const tags = (
    await Promise.all(
      productTagRows.map((pt: any) => ctx.db.get(pt.tagId))
    )
  ).filter(Boolean).map((t: any) => ({ _id: t._id, name: t.name, slug: t.slug }));

  const variants = await ctx.db
    .query("productVariants")
    .withIndex("by_productId", (q: any) => q.eq("productId", product._id))
    .take(50);

  return {
    ...product,
    discountedPrice,
    discountAmount,
    campaignName,
    tags,
    variants,
  };
}

// ─── PUBLIC QUERIES ────────────────────────────────────────

export const search = query({
  args: {
    query: v.string(),
    paginationOpts: paginationOptsValidator,
    categoryId: v.optional(v.id("categories")),
  },
  handler: async (ctx, args) => {
    let searchQuery = ctx.db
      .query("products")
      .withSearchIndex("search_name", (q) => {
        let sq = q.search("name", args.query);
        if (args.categoryId) sq = sq.eq("categoryId", args.categoryId);
        return sq.eq("isActive", true);
      });

    const result = await searchQuery.paginate(args.paginationOpts);
    const enriched = await Promise.all(result.page.map((p) => enrichProduct(ctx, p)));
    return { ...result, page: enriched };
  },
});

export const listFiltered = query({
  args: {
    paginationOpts: paginationOptsValidator,
    categoryId: v.optional(v.id("categories")),
    tagId: v.optional(v.id("tags")),
    minPrice: v.optional(v.number()),
    maxPrice: v.optional(v.number()),
    size: v.optional(v.string()),
    color: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let tagProductIds: Set<Id<"products">> | null = null;
    if (args.tagId) {
      const rows = await ctx.db
        .query("productTags")
        .withIndex("by_tagId", (q) => q.eq("tagId", args.tagId!))
        .take(500);
      tagProductIds = new Set(rows.map((r) => r.productId));
    }

    let variantProductIds: Set<Id<"products">> | null = null;
    if (args.size || args.color) {
      if (args.size) {
        const sizeVariants = await ctx.db
          .query("productVariants")
          .order("asc")
          .take(2000);
        variantProductIds = new Set(
          sizeVariants
            .filter(
              (v) =>
                (!args.size || v.size === args.size) &&
                (!args.color || v.color === args.color)
            )
            .map((v) => v.productId)
        );
      }
    }

    let dbQuery;
    if (args.categoryId) {
      dbQuery = ctx.db
        .query("products")
        .withIndex("by_categoryId_and_isActive", (q: any) =>
          q.eq("categoryId", args.categoryId).eq("isActive", true)
        );
    } else {
      dbQuery = ctx.db
        .query("products")
        .withIndex("by_isActive", (q: any) => q.eq("isActive", true));
    }

    const result = await dbQuery.paginate(args.paginationOpts);

    const filtered = result.page.filter((p: Doc<"products">) => {
      if (tagProductIds && !tagProductIds.has(p._id)) return false;
      if (variantProductIds && !variantProductIds.has(p._id)) return false;
      if (args.minPrice !== undefined && p.basePrice < args.minPrice) return false;
      if (args.maxPrice !== undefined && p.basePrice > args.maxPrice) return false;
      return true;
    });

    const enriched = await Promise.all(filtered.map((p: Doc<"products">) => enrichProduct(ctx, p)));
    return { ...result, page: enriched };
  },
});

export const getBySlug = query({
  args: { slug: v.string() },
  returns: v.union(productWithPricingValidator, v.null()),
  handler: async (ctx, args) => {
    const product = await ctx.db
      .query("products")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
    if (!product || !product.isActive) return null;
    return enrichProduct(ctx, product);
  },
});

/** Admin: get product by id including inactive */
export const getById = query({
  args: { id: v.id("products") },
  returns: v.union(productWithPricingValidator, v.null()),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const product = await ctx.db.get(args.id);
    if (!product) return null;
    return enrichProduct(ctx, product);
  },
});

/** Landing page: top 3 best sellers by sortOrder from recommendations table */
export const getFeaturedBestSellers = query({
  args: {},
  returns: v.array(productWithPricingValidator),
  handler: async (ctx) => {
    const recs = await ctx.db
      .query("productRecommendations")
      .withIndex("by_type", (q) => q.eq("type", "best_sellers"))
      .order("asc")
      .take(3);

    const products = await Promise.all(
      recs.map(async (rec) => {
        const product = await ctx.db.get(rec.recommendedProductId);
        if (!product || !product.isActive) return null;
        return enrichProduct(ctx, product);
      })
    );
    return products.filter(Boolean) as Awaited<ReturnType<typeof enrichProduct>>[];
  },
});

/** Landing page: top 3 new arrivals by sortOrder from recommendations table */
export const getFeaturedNewArrivals = query({
  args: {},
  returns: v.array(productWithPricingValidator),
  handler: async (ctx) => {
    const recs = await ctx.db
      .query("productRecommendations")
      .withIndex("by_type", (q) => q.eq("type", "new_arrivals"))
      .order("asc")
      .take(3);

    const products = await Promise.all(
      recs.map(async (rec) => {
        const product = await ctx.db.get(rec.recommendedProductId);
        if (!product || !product.isActive) return null;
        return enrichProduct(ctx, product);
      })
    );
    return products.filter(Boolean) as Awaited<ReturnType<typeof enrichProduct>>[];
  },
});

/** Check if a slug is available (for inline validation on product forms) */
export const checkSlugAvailable = query({
  args: {
    slug: v.string(),
    excludeId: v.optional(v.id("products")),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    if (!args.slug.trim()) return true;
    const existing = await ctx.db
      .query("products")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
    if (!existing) return true;
    if (args.excludeId && existing._id === args.excludeId) return true;
    return false;
  },
});

/** Admin: lightweight product search for the recommendations picker */
export const searchForPicker = query({
  args: { query: v.string() },
  returns: v.array(
    v.object({
      _id: v.id("products"),
      name: v.string(),
      slug: v.string(),
    })
  ),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    if (!args.query.trim()) return [];
    const results = await ctx.db
      .query("products")
      .withSearchIndex("search_name", (q) => q.search("name", args.query))
      .take(10);
    return results.map((p) => ({ _id: p._id, name: p.name, slug: p.slug }));
  },
});

/** Admin: list all products paginated */
export const listAllAdmin = query({
  args: {
    paginationOpts: paginationOptsValidator,
    searchQuery: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    if (args.searchQuery && args.searchQuery.trim()) {
      return await ctx.db
        .query("products")
        .withSearchIndex("search_name", (q) =>
          q.search("name", args.searchQuery!)
        )
        .paginate(args.paginationOpts);
    }
    return await ctx.db.query("products").order("desc").paginate(args.paginationOpts);
  },
});

// ─── ADMIN MUTATIONS ───────────────────────────────────────

export const create = mutation({
  args: {
    name: v.string(),
    slug: v.string(),
    description: v.string(),
    categoryId: v.id("categories"),
    basePrice: v.number(),
    media: v.array(mediaItemValidator),
    variants: v.array(
      v.object({
        size: v.string(),
        color: v.optional(v.string()),
        sku: v.optional(v.string()),
        stock: v.number(),
        priceOverride: v.optional(v.number()),
      })
    ),
  },
  returns: v.id("products"),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    if (args.basePrice <= 0) throw new ConvexError("Price must be positive");
    if (args.variants.length === 0) throw new ConvexError("At least one variant required");

    const existing = await ctx.db
      .query("products")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
    if (existing) throw new ConvexError("Slug already in use");

    const { variants, ...productData } = args;

    const productId = await ctx.db.insert("products", {
      ...productData,
      isActive: true,
      totalRatings: 0,
      averageRating: 0,
    });

    const product = await ctx.db.get(productId);
    if (product) await aggregateProducts.insertIfDoesNotExist(ctx, product);

    await Promise.all(
      variants.map((v) => ctx.db.insert("productVariants", { ...v, productId }))
    );

    return productId;
  },
});

export const update = mutation({
  args: {
    id: v.id("products"),
    name: v.optional(v.string()),
    slug: v.optional(v.string()),
    description: v.optional(v.string()),
    categoryId: v.optional(v.id("categories")),
    basePrice: v.optional(v.number()),
    media: v.optional(v.array(mediaItemValidator)),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const { id, ...updates } = args;

    if (updates.basePrice !== undefined && updates.basePrice <= 0) {
      throw new ConvexError("Price must be positive");
    }

    if (updates.slug) {
      const existing = await ctx.db
        .query("products")
        .withIndex("by_slug", (q) => q.eq("slug", updates.slug!))
        .unique();
      if (existing && existing._id !== id) throw new ConvexError("Slug already in use");
    }

    const clean = Object.fromEntries(
      Object.entries(updates).filter(([, v]) => v !== undefined)
    );
    if (Object.keys(clean).length > 0) await ctx.db.patch(id, clean);
    return null;
  },
});

export const updateVariants = mutation({
  args: {
    productId: v.id("products"),
    variants: v.array(
      v.object({
        id: v.optional(v.id("productVariants")),
        size: v.string(),
        color: v.optional(v.string()),
        sku: v.optional(v.string()),
        stock: v.number(),
        priceOverride: v.optional(v.number()),
      })
    ),
    deleteIds: v.optional(v.array(v.id("productVariants"))),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    if (args.deleteIds) {
      await Promise.all(args.deleteIds.map((id) => ctx.db.delete(id)));
    }

    await Promise.all(
      args.variants.map(({ id, ...data }) => {
        if (id) {
          return ctx.db.patch(id, data);
        } else {
          return ctx.db.insert("productVariants", { ...data, productId: args.productId });
        }
      })
    );

    return null;
  },
});

export const toggleActive = mutation({
  args: { id: v.id("products"), isActive: v.boolean() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const old = await ctx.db.get(args.id);
    if (!old) throw new ConvexError("Product not found");
    await ctx.db.patch(args.id, { isActive: args.isActive });
    const updated = await ctx.db.get(args.id);
    if (updated) await aggregateProducts.replaceOrInsert(ctx, old, updated);
    return null;
  },
});

/** Replace all tags for a product */
export const assignTags = mutation({
  args: {
    productId: v.id("products"),
    tagIds: v.array(v.id("tags")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const existing = await ctx.db
      .query("productTags")
      .withIndex("by_productId", (q) => q.eq("productId", args.productId))
      .take(100);
    await Promise.all(existing.map((r) => ctx.db.delete(r._id)));

    await Promise.all(
      args.tagIds.map((tagId) =>
        ctx.db.insert("productTags", { productId: args.productId, tagId })
      )
    );
    return null;
  },
});

export const remove = mutation({
  args: { id: v.id("products") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const product = await ctx.db.get(args.id);
    if (!product) return null;

    // Delete variants in batches
    let done = false;
    while (!done) {
      const variants = await ctx.db
        .query("productVariants")
        .withIndex("by_productId", (q) => q.eq("productId", args.id))
        .take(64);
      if (variants.length === 0) { done = true; } else {
        await Promise.all(variants.map((v) => ctx.db.delete(v._id)));
      }
    }

    // Delete product tags
    done = false;
    while (!done) {
      const tags = await ctx.db
        .query("productTags")
        .withIndex("by_productId", (q) => q.eq("productId", args.id))
        .take(64);
      if (tags.length === 0) { done = true; } else {
        await Promise.all(tags.map((t) => ctx.db.delete(t._id)));
      }
    }

    // Remove from any recommendation sections
    done = false;
    while (!done) {
      const recs = await ctx.db
        .query("productRecommendations")
        .order("asc")
        .take(64);
      const matching = recs.filter((r) => r.recommendedProductId === args.id);
      if (matching.length === 0) { done = true; } else {
        await Promise.all(matching.map((r) => ctx.db.delete(r._id)));
      }
    }

    await ctx.db.delete(args.id);
    await aggregateProducts.deleteIfExists(ctx, product);
    return null;
  },
});
