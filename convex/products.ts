import { query, mutation } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { requireAdmin } from "./lib/auth.helpers";
import { aggregateProducts } from "./lib/aggregates";
import { getEffectivePrice, isProductVisible } from "./lib/discounts";
import { Doc, Id } from "./_generated/dataModel";
import { r2 } from "./r2";

// ─── SKU HELPERS ───────────────────────────────────────────

const SKU_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

/** Build a name-derived 3-letter prefix (uppercase, letters only, padded with X). */
function skuPrefix(name: string): string {
  const letters = name.toUpperCase().replace(/[^A-Z]/g, "");
  return (letters + "XXX").slice(0, 3);
}

/** Generate a random 6-char alphanumeric suffix. */
function skuRandomSuffix(): string {
  let s = "";
  for (let i = 0; i < 6; i++) {
    s += SKU_CHARS[Math.floor(Math.random() * SKU_CHARS.length)];
  }
  return s;
}

/** Build a full SKU string: "PREFIX-SUFFIX" */
function buildSku(name: string): string {
  return `${skuPrefix(name)}-${skuRandomSuffix()}`;
}

/**
 * Generates a unique SKU for a product. Retries up to 10 times on collision
 * (collision probability with 36^6 ≈ 2.18B combinations is negligible but handled).
 */
async function generateUniqueSku(
  ctx: { db: any },
  name: string,
  excludeId?: Id<"products">
): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const sku = buildSku(name);
    const existing = await ctx.db
      .query("products")
      .withIndex("by_sku", (q: any) => q.eq("sku", sku))
      .unique();
    if (!existing || (excludeId && existing._id === excludeId)) return sku;
  }
  throw new ConvexError(
    "Could not generate a unique SKU after 10 attempts. Please try again."
  );
}

// ─── SHARED VALIDATORS ─────────────────────────────────────

const mediaItemValidator = v.object({
  storageId: v.string(),
  type: v.union(v.literal("image"), v.literal("video"), v.literal("model3d")),
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

const productStatusValidator = v.union(
  v.literal("draft"),
  v.literal("active"),
  v.literal("scheduled"),
  v.literal("archived")
);

const productWithPricingValidator = v.object({
  _id: v.id("products"),
  _creationTime: v.number(),
  name: v.string(),
  slug: v.string(),
  sku: v.string(),
  description: v.string(),
  categoryId: v.optional(v.id("categories")),
  basePrice: v.number(),
  status: productStatusValidator,
  scheduledPublishTime: v.optional(v.number()),
  saleEnabled: v.boolean(),
  salePrice: v.optional(v.number()),
  saleStartMode: v.union(v.literal("immediately"), v.literal("custom")),
  saleStartTime: v.optional(v.number()),
  saleEndMode: v.union(v.literal("indefinite"), v.literal("custom")),
  saleEndTime: v.optional(v.number()),
  saleDisplayMode: v.optional(v.union(v.literal("percentage"), v.literal("amount"))),
  metaTitle: v.optional(v.string()),
  metaDescription: v.optional(v.string()),
  globalSortOrder: v.number(),
  categorySortOrder: v.number(),
  effectivePrice: v.number(),
  discountAmount: v.number(),
  discountSource: v.union(v.literal("group"), v.literal("individual"), v.null()),
  discountGroupName: v.union(v.string(), v.null()),
  totalRatings: v.number(),
  averageRating: v.number(),
  media: v.array(mediaItemValidator),
  tags: v.array(v.object({ _id: v.id("tags"), name: v.string(), slug: v.string() })),
  variants: v.array(variantValidator),
});

// ─── HELPERS ───────────────────────────────────────────────

async function enrichProduct(ctx: any, product: Doc<"products">) {
  const { effectivePrice, discountAmount, discountSource, discountGroupName } =
    await getEffectivePrice(ctx, product);

  const productTagRows = await ctx.db
    .query("productTags")
    .withIndex("by_productId", (q: any) => q.eq("productId", product._id))
    .take(50);

  const tags = (
    await Promise.all(productTagRows.map((pt: any) => ctx.db.get(pt.tagId)))
  )
    .filter(Boolean)
    .map((t: any) => ({ _id: t._id, name: t.name, slug: t.slug }));

  const variants = await ctx.db
    .query("productVariants")
    .withIndex("by_productId", (q: any) => q.eq("productId", product._id))
    .take(50);

  return {
    ...product,
    effectivePrice,
    discountAmount,
    discountSource,
    discountGroupName,
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
    const now = Date.now();

    // Search active products
    const activeResult = await ctx.db
      .query("products")
      .withSearchIndex("search_name", (q: any) => {
        let sq = q.search("name", args.query).eq("status", "active");
        if (args.categoryId) sq = sq.eq("categoryId", args.categoryId);
        return sq;
      })
      .paginate(args.paginationOpts);

    // Also search scheduled products whose time has passed (treated as active)
    const scheduledProducts = await ctx.db
      .query("products")
      .withSearchIndex("search_name", (q: any) => {
        let sq = q.search("name", args.query).eq("status", "scheduled");
        if (args.categoryId) sq = sq.eq("categoryId", args.categoryId);
        return sq;
      })
      .take(100);

    const scheduledVisible = scheduledProducts.filter(
      (p: Doc<"products">) =>
        p.scheduledPublishTime !== undefined && p.scheduledPublishTime <= now
    );

    const combined = [...activeResult.page, ...scheduledVisible];
    const enriched = await Promise.all(combined.map((p) => enrichProduct(ctx, p)));
    return { ...activeResult, page: enriched };
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
    const now = Date.now();

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
      const allVariants = await ctx.db
        .query("productVariants")
        .order("asc")
        .take(2000);
      variantProductIds = new Set(
        allVariants
          .filter(
            (v) =>
              (!args.size || v.size === args.size) &&
              (!args.color || v.color === args.color)
          )
          .map((v) => v.productId)
      );
    }

    // Fetch active products, sorted by globalSortOrder
    let activeResult;
    if (args.categoryId) {
      activeResult = await ctx.db
        .query("products")
        .withIndex("by_categoryId_and_categorySortOrder", (q: any) =>
          q.eq("categoryId", args.categoryId)
        )
        .paginate(args.paginationOpts);
      // Filter to only active/visible
      activeResult = {
        ...activeResult,
        page: activeResult.page.filter((p: Doc<"products">) =>
          isProductVisible(p, now)
        ),
      };
    } else {
      activeResult = await ctx.db
        .query("products")
        .withIndex("by_status_and_globalSortOrder", (q: any) =>
          q.eq("status", "active")
        )
        .paginate(args.paginationOpts);

      // Fetch scheduled products that have gone live
      const scheduled = await ctx.db
        .query("products")
        .withIndex("by_status", (q) => q.eq("status", "scheduled"))
        .take(200);
      const scheduledVisible = scheduled.filter((p) => isProductVisible(p, now));

      activeResult = {
        ...activeResult,
        page: [...activeResult.page, ...scheduledVisible],
      };
    }

    const filtered = activeResult.page.filter((p: Doc<"products">) => {
      if (tagProductIds && !tagProductIds.has(p._id)) return false;
      if (variantProductIds && !variantProductIds.has(p._id)) return false;
      if (args.minPrice !== undefined && p.basePrice < args.minPrice) return false;
      if (args.maxPrice !== undefined && p.basePrice > args.maxPrice) return false;
      return true;
    });

    const enriched = await Promise.all(
      filtered.map((p: Doc<"products">) => enrichProduct(ctx, p))
    );
    return { ...activeResult, page: enriched };
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
    if (!product || !isProductVisible(product)) return null;
    return enrichProduct(ctx, product);
  },
});

/** Admin: get product by id including non-visible */
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

/** Check if a slug is available */
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

/** Check if a SKU is available (case-insensitive, stored uppercase) */
export const checkSkuAvailable = query({
  args: {
    sku: v.string(),
    excludeId: v.optional(v.id("products")),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const normalized = args.sku.trim().toUpperCase();
    if (!normalized) return true;
    const existing = await ctx.db
      .query("products")
      .withIndex("by_sku", (q) => q.eq("sku", normalized))
      .unique();
    if (!existing) return true;
    if (args.excludeId && existing._id === args.excludeId) return true;
    return false;
  },
});

/** Admin: lightweight product search for pickers */
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

/**
 * Admin: fetch ALL products in one query (no pagination).
 * Used by the admin products page — all tab filtering/grouping happens client-side.
 */
export const listAllAdminFlat = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);

    const products = await ctx.db.query("products").order("asc").take(500);

    const enriched = await Promise.all(
      products.map(async (p) => {
        const pricing = await getEffectivePrice(ctx, p);

        const productTagRows = await ctx.db
          .query("productTags")
          .withIndex("by_productId", (q) => q.eq("productId", p._id))
          .take(50);

        const tagIds = productTagRows.map((pt) => pt.tagId);
        // Include productTagId for drag-and-drop reordering within tags
        const productTagEntries = productTagRows.map((pt) => ({ productTagId: pt._id, tagId: pt.tagId, sortOrder: pt.sortOrder }));

        const variants = await ctx.db
          .query("productVariants")
          .withIndex("by_productId", (q) => q.eq("productId", p._id))
          .take(50);

        const firstImage = p.media.find((m) => m.type === "image");
        const imageUrl = firstImage
          ? await r2.getUrl(firstImage.storageId)
          : null;

        return {
          ...p,
          ...pricing,
          tagIds,
          productTagEntries,
          variants,
          imageUrl,
        };
      })
    );

    return enriched;
  },
});

/** Legacy paginated admin list — kept for backwards compat with other pages */
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
    sku: v.optional(v.string()), // auto-generated server-side if omitted
    description: v.string(),
    categoryId: v.optional(v.id("categories")),
    basePrice: v.number(),
    // Publishing
    status: v.optional(productStatusValidator),
    scheduledPublishTime: v.optional(v.number()),
    // Sale pricing
    saleEnabled: v.optional(v.boolean()),
    salePrice: v.optional(v.number()),
    saleStartMode: v.optional(v.union(v.literal("immediately"), v.literal("custom"))),
    saleStartTime: v.optional(v.number()),
    saleEndMode: v.optional(v.union(v.literal("indefinite"), v.literal("custom"))),
    saleEndTime: v.optional(v.number()),
    saleDisplayMode: v.optional(v.union(v.literal("percentage"), v.literal("amount"))),
    // SEO
    metaTitle: v.optional(v.string()),
    metaDescription: v.optional(v.string()),
    // Media & Variants
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

    // SKU: validate provided or auto-generate a unique one
    let sku: string;
    if (args.sku?.trim()) {
      sku = args.sku.trim().toUpperCase();
      const skuExists = await ctx.db
        .query("products")
        .withIndex("by_sku", (q) => q.eq("sku", sku))
        .unique();
      if (skuExists) throw new ConvexError("SKU already in use");
    } else {
      sku = await generateUniqueSku(ctx, args.name);
    }

    // Compute globalSortOrder: new product goes to top (min - 1)
    const topGlobal = await ctx.db
      .query("products")
      .withIndex("by_status_and_globalSortOrder", (q: any) =>
        q.eq("status", args.status ?? "draft")
      )
      .order("asc")
      .take(1);
    const globalSortOrder =
      topGlobal.length > 0 ? topGlobal[0].globalSortOrder - 1 : 0;

    // Compute categorySortOrder: top of its category
    let categorySortOrder = 0;
    if (args.categoryId) {
      const topCategory = await ctx.db
        .query("products")
        .withIndex("by_categoryId_and_categorySortOrder", (q: any) =>
          q.eq("categoryId", args.categoryId!)
        )
        .order("asc")
        .take(1);
      categorySortOrder = topCategory.length > 0 ? topCategory[0].categorySortOrder - 1 : 0;
    }

    const { variants, sku: _skuArg, ...productData } = args;

    const productId = await ctx.db.insert("products", {
      ...productData,
      sku,
      status: args.status ?? "draft",
      saleEnabled: args.saleEnabled ?? true,
      saleStartMode: args.saleStartMode ?? "immediately",
      saleEndMode: args.saleEndMode ?? "indefinite",
      globalSortOrder,
      categorySortOrder,
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
    sku: v.optional(v.string()),
    description: v.optional(v.string()),
    categoryId: v.optional(v.union(v.id("categories"), v.null())),
    basePrice: v.optional(v.number()),
    // Publishing
    status: v.optional(productStatusValidator),
    scheduledPublishTime: v.optional(v.number()),
    // Sale pricing
    saleEnabled: v.optional(v.boolean()),
    salePrice: v.optional(v.number()),
    saleStartMode: v.optional(v.union(v.literal("immediately"), v.literal("custom"))),
    saleStartTime: v.optional(v.number()),
    saleEndMode: v.optional(v.union(v.literal("indefinite"), v.literal("custom"))),
    saleEndTime: v.optional(v.number()),
    saleDisplayMode: v.optional(v.union(v.literal("percentage"), v.literal("amount"))),
    // SEO
    metaTitle: v.optional(v.string()),
    metaDescription: v.optional(v.string()),
    // Media
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

    // Delete R2 objects for any media items that were removed
    if (updates.media !== undefined) {
      const product = await ctx.db.get(id);
      if (product) {
        const newKeys = new Set(updates.media.map((m) => m.storageId));
        const removedKeys = product.media
          .map((m) => m.storageId)
          .filter((key) => !newKeys.has(key));
        await Promise.all(removedKeys.map((key) => r2.deleteObject(ctx, key)));
      }
    }

    // Normalize and validate SKU uniqueness if provided
    if (updates.sku !== undefined) {
      updates.sku = updates.sku.trim().toUpperCase();
      if (updates.sku) {
        const existing = await ctx.db
          .query("products")
          .withIndex("by_sku", (q: any) => q.eq("sku", updates.sku!))
          .unique();
        if (existing && existing._id !== id) throw new ConvexError("SKU already in use");
      }
    }

    // Convert null categoryId to undefined (explicit removal)
    let explicitRemoveCategory = false;
    if (updates.categoryId === null) {
      (updates as any).categoryId = undefined;
      explicitRemoveCategory = true;
    } else if (updates.categoryId !== undefined) {
      // If category changed, recompute categorySortOrder to top of new category
      const topCategory = await ctx.db
        .query("products")
        .withIndex("by_categoryId_and_categorySortOrder", (q: any) =>
          q.eq("categoryId", updates.categoryId!)
        )
        .order("asc")
        .take(1);
      (updates as any).categorySortOrder =
        topCategory.length > 0 ? topCategory[0].categorySortOrder - 1 : 0;
    }

    const clean = Object.fromEntries(
      Object.entries(updates).filter(([k, v]) => v !== undefined || (k === "categoryId" && explicitRemoveCategory))
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

/** Replace all tags for a product */
export const assignTags = mutation({
  args: {
    productId: v.id("products"),
    tagIds: v.array(v.id("tags")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const oldRows = await ctx.db
      .query("productTags")
      .withIndex("by_productId", (q) => q.eq("productId", args.productId))
      .take(100);
    const oldTagIds = new Set(oldRows.map((r) => r.tagId));
    const newTagSet = new Set(args.tagIds);
    // Preserve existing sortOrders for tags that remain
    const oldSortOrderByTagId = new Map(oldRows.map((r) => [r.tagId as string, r.sortOrder]));

    await Promise.all(oldRows.map((r) => ctx.db.delete(r._id)));
    await Promise.all(
      args.tagIds.map(async (tagId) => {
        let sortOrder: number;
        const existing = oldSortOrderByTagId.get(tagId as string);
        if (existing !== undefined) {
          sortOrder = existing;
        } else {
          // New tag assignment — put at end of this tag's product list
          const tagRows = await ctx.db
            .query("productTags")
            .withIndex("by_tagId", (q) => q.eq("tagId", tagId))
            .take(500);
          sortOrder = tagRows.length > 0 ? Math.max(...tagRows.map((r) => r.sortOrder)) + 1 : 0;
        }
        return ctx.db.insert("productTags", { productId: args.productId, tagId, sortOrder });
      })
    );

    const addedTagIds = args.tagIds.filter((tagId) => !oldTagIds.has(tagId));
    const removedTagIds = [...oldTagIds].filter((tagId) => !newTagSet.has(tagId));

    for (const tagId of removedTagIds) {
      const sections = await ctx.db
        .query("landingPageProductSections")
        .withIndex("by_tagId", (q) => q.eq("tagId", tagId))
        .collect();
      for (const section of sections) {
        const item = await ctx.db
          .query("landingPageProductSectionItems")
          .withIndex("by_sectionId_and_productId", (q) =>
            q.eq("sectionId", section._id).eq("productId", args.productId)
          )
          .first();
        if (item) await ctx.db.delete(item._id);
      }
    }

    for (const tagId of addedTagIds) {
      const sections = await ctx.db
        .query("landingPageProductSections")
        .withIndex("by_tagId", (q) => q.eq("tagId", tagId))
        .collect();
      for (const section of sections) {
        const existingItem = await ctx.db
          .query("landingPageProductSectionItems")
          .withIndex("by_sectionId_and_productId", (q) =>
            q.eq("sectionId", section._id).eq("productId", args.productId)
          )
          .first();
        if (!existingItem) {
          const allItems = await ctx.db
            .query("landingPageProductSectionItems")
            .withIndex("by_sectionId", (q) => q.eq("sectionId", section._id))
            .collect();
          const maxSort = allItems.reduce((max, i) => Math.max(max, i.sortOrder), -1);
          await ctx.db.insert("landingPageProductSectionItems", {
            sectionId: section._id,
            productId: args.productId,
            sortOrder: maxSort + 1,
          });
        }
      }
    }

    return null;
  },
});

/** Update product publishing status */
export const updateStatus = mutation({
  args: {
    id: v.id("products"),
    status: productStatusValidator,
    scheduledPublishTime: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const old = await ctx.db.get(args.id);
    if (!old) throw new ConvexError("Product not found");

    const patch: Record<string, any> = { status: args.status };
    if (args.scheduledPublishTime !== undefined) {
      patch.scheduledPublishTime = args.scheduledPublishTime;
    }
    await ctx.db.patch(args.id, patch);

    const updated = await ctx.db.get(args.id);
    if (updated) await aggregateProducts.replaceOrInsert(ctx, old, updated);
    return null;
  },
});

/** Reorder products globally (for main catalog order) */
export const reorderGlobal = mutation({
  args: {
    items: v.array(
      v.object({ id: v.id("products"), sortOrder: v.number() })
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await Promise.all(
      args.items.map((item) =>
        ctx.db.patch(item.id, { globalSortOrder: item.sortOrder })
      )
    );
    return null;
  },
});

/** Reorder products within a category */
export const reorderCategory = mutation({
  args: {
    items: v.array(
      v.object({ id: v.id("products"), sortOrder: v.number() })
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await Promise.all(
      args.items.map((item) =>
        ctx.db.patch(item.id, { categorySortOrder: item.sortOrder })
      )
    );
    return null;
  },
});

/** Reorder products within a tag (patches productTags sortOrder) */
export const reorderTag = mutation({
  args: {
    items: v.array(
      v.object({ productTagId: v.id("productTags"), sortOrder: v.number() })
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await Promise.all(
      args.items.map((item) =>
        ctx.db.patch(item.productTagId, { sortOrder: item.sortOrder })
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

    // Delete all R2 media objects for this product
    if (product.media.length > 0) {
      await Promise.all(product.media.map((m) => r2.deleteObject(ctx, m.storageId)));
    }

    // Collect variant IDs before deletion (needed for rec cleanup)
    const allVariants = await ctx.db
      .query("productVariants")
      .withIndex("by_productId", (q) => q.eq("productId", args.id))
      .take(500);
    const variantIds = new Set(allVariants.map((v) => v._id));

    // Delete variants
    let done = false;
    while (!done) {
      const variants = await ctx.db
        .query("productVariants")
        .withIndex("by_productId", (q) => q.eq("productId", args.id))
        .take(64);
      if (variants.length === 0) {
        done = true;
      } else {
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
      if (tags.length === 0) {
        done = true;
      } else {
        await Promise.all(tags.map((t) => ctx.db.delete(t._id)));
      }
    }

    // Delete discount group memberships
    done = false;
    while (!done) {
      const dgRows = await ctx.db
        .query("discountGroupProducts")
        .withIndex("by_productId", (q) => q.eq("productId", args.id))
        .take(64);
      if (dgRows.length === 0) {
        done = true;
      } else {
        await Promise.all(dgRows.map((r) => ctx.db.delete(r._id)));
      }
    }

    // Delete landing page section items
    done = false;
    while (!done) {
      const sectionItems = await ctx.db
        .query("landingPageProductSectionItems")
        .withIndex("by_productId", (q) => q.eq("productId", args.id))
        .take(64);
      if (sectionItems.length === 0) {
        done = true;
      } else {
        await Promise.all(sectionItems.map((si) => ctx.db.delete(si._id)));
      }
    }

    // Remove from recommendations (scan since no productId index there)
    done = false;
    while (!done) {
      const recs = await ctx.db
        .query("productRecommendations")
        .order("asc")
        .take(64);
      const matching = recs.filter(
        (r) => r.recommendedProductId === args.id ||
          (r.recommendedVariantId !== undefined && variantIds.has(r.recommendedVariantId))
      );
      if (matching.length === 0) {
        done = true;
      } else {
        await Promise.all(matching.map((r) => ctx.db.delete(r._id)));
      }
    }

    await ctx.db.delete(args.id);
    await aggregateProducts.deleteIfExists(ctx, product);
    return null;
  },
});
