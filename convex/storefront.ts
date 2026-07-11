import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { query, QueryCtx } from "./_generated/server";
import { getEffectivePrice, isProductVisible } from "./lib/discounts";
import {
  getActiveSizeMaps,
  withResolvedVariantSize,
} from "./lib/variantSizes";

type MediaItem = {
  storageId: string;
  type: "image" | "video" | "model3d";
  sortOrder: number;
};

function firstImageStorageId(items: MediaItem[] = []) {
  return [...items]
    .filter((item) => item.type === "image")
    .sort((a, b) => a.sortOrder - b.sortOrder)[0]?.storageId ?? null;
}

function colorFirstImageStorageIds(product: Doc<"products">) {
  const commonFallback = firstImageStorageId(product.commonMediaTop ?? []);

  return product.variantMedia.map((entry) => ({
    color: entry.color,
    storageId: firstImageStorageId(entry.media) ?? commonFallback,
  }));
}

async function listVisibleProducts(ctx: QueryCtx) {
  const now = Date.now();
  const [active, scheduled] = await Promise.all([
    ctx.db
      .query("products")
      .withIndex("by_status_and_globalSortOrder", (q) =>
        q.eq("status", "active"),
      )
      .take(300),
    ctx.db
      .query("products")
      .withIndex("by_status", (q) => q.eq("status", "scheduled"))
      .take(100),
  ]);

  return [...active, ...scheduled.filter((product) => isProductVisible(product, now))]
    .filter(
      (product, index, products) =>
        products.findIndex((candidate) => candidate._id === product._id) ===
        index,
    )
    .sort((a, b) => a.globalSortOrder - b.globalSortOrder);
}

async function getProductTags(ctx: QueryCtx, productId: Id<"products">) {
  const rows = await ctx.db
    .query("productTags")
    .withIndex("by_productId", (q) => q.eq("productId", productId))
    .take(50);

  return (
    await Promise.all(rows.map((row) => ctx.db.get(row.tagId)))
  )
    .filter((tag): tag is Doc<"tags"> => Boolean(tag?.isActive))
    .map((tag) => ({ _id: tag._id, name: tag.name, slug: tag.slug }));
}

async function getProductVariants(
  ctx: QueryCtx,
  productId: Id<"products">,
  sizeMaps: Awaited<ReturnType<typeof getActiveSizeMaps>>,
) {
  const variants = await ctx.db
    .query("productVariants")
    .withIndex("by_productId", (q) => q.eq("productId", productId))
    .take(100);

  return variants
    .map((variant) => withResolvedVariantSize(variant, sizeMaps))
    .filter((variant): variant is NonNullable<typeof variant> => Boolean(variant));
}

async function getProductCard(
  ctx: QueryCtx,
  product: Doc<"products">,
  sizeMaps: Awaited<ReturnType<typeof getActiveSizeMaps>>,
) {
  const [pricing, tags, variants] = await Promise.all([
    getEffectivePrice(ctx, product),
    getProductTags(ctx, product._id),
    getProductVariants(ctx, product._id, sizeMaps),
  ]);

  return {
    _id: product._id,
    _creationTime: product._creationTime,
    name: product.name,
    slug: product.slug,
    description: product.description,
    categoryId: product.categoryId,
    basePrice: product.basePrice,
    globalSortOrder: product.globalSortOrder,
    categorySortOrder: product.categorySortOrder,
    saleDiscountSortOrder: product.saleDiscountSortOrder,
    saleEnabled: product.saleEnabled,
    saleStartMode: product.saleStartMode,
    saleStartTime: product.saleStartTime,
    saleEndMode: product.saleEndMode,
    saleEndTime: product.saleEndTime,
    effectivePrice: pricing.effectivePrice,
    discountAmount: pricing.discountAmount,
    discountSource: pricing.discountSource,
    discountGroupName: pricing.discountGroupName,
    discountEndTime: pricing.discountEndTime,
    averageRating: product.averageRating,
    totalRatings: product.totalRatings,
    thumbnailStorageId: product.thumbnailStorageId ?? null,
    hoverThumbnailStorageId: product.hoverThumbnailStorageId ?? null,
    colorFirstImageStorageIds: colorFirstImageStorageIds(product),
    tags,
    variants: variants.map((variant) => ({
      _id: variant._id,
      size: variant.size,
      color: variant.color,
      stock: variant.stock,
    })),
  };
}

async function getNavigation(ctx: QueryCtx) {
  const rows = await ctx.db
    .query("navbarCategories")
    .withIndex("by_sortOrder")
    .order("asc")
    .take(20);

  return (
    await Promise.all(
      rows.map(async (row) => {
        const category = await ctx.db.get(row.categoryId);
        if (!category?.isActive) return null;
        return {
          _id: row._id,
          categoryId: category._id,
          name: category.name,
          slug: category.slug,
          sortOrder: row.sortOrder,
        };
      }),
    )
  ).filter((item): item is NonNullable<typeof item> => Boolean(item));
}

async function getActiveCategories(ctx: QueryCtx) {
  const categories = await ctx.db
    .query("categories")
    .withIndex("by_isActive_and_sortOrder", (q) => q.eq("isActive", true))
    .take(100);
  return [...categories].sort((a, b) => a.sortOrder - b.sortOrder);
}

async function getMarketingSettings(ctx: QueryCtx) {
  const [facebookDoc, googleDoc, scriptsDoc] = await Promise.all([
    ctx.db
      .query("marketingSettings")
      .withIndex("by_type", (q) => q.eq("type", "facebook"))
      .unique(),
    ctx.db
      .query("marketingSettings")
      .withIndex("by_type", (q) => q.eq("type", "google"))
      .unique(),
    ctx.db
      .query("marketingSettings")
      .withIndex("by_type", (q) => q.eq("type", "customScripts"))
      .unique(),
  ]);
  const facebook = facebookDoc?.config as
    | { pixelId?: string; browserEnabled?: boolean }
    | undefined;
  const google = googleDoc?.config as
    | { ga4MeasurementId?: string; enabled?: boolean }
    | undefined;
  const scripts = scriptsDoc?.config as
    | { headScripts?: string; bodyScripts?: string }
    | undefined;

  return {
    facebookPixelId: facebook?.pixelId ?? null,
    facebookBrowserEnabled: facebook?.browserEnabled ?? false,
    ga4MeasurementId: google?.ga4MeasurementId ?? null,
    googleEnabled: google?.enabled ?? false,
    headScripts: scripts?.headScripts ?? null,
    bodyScripts: scripts?.bodyScripts ?? null,
  };
}

export const getShell = query({
  args: {},
  handler: async (ctx) => {
    const [navigation, categories, predefinedQueries, products, marketing] =
      await Promise.all([
        getNavigation(ctx),
        getActiveCategories(ctx),
        ctx.db.query("predefinedSearchQueries").order("asc").take(30),
        listVisibleProducts(ctx),
        getMarketingSettings(ctx),
      ]);
    const sizeMaps = await getActiveSizeMaps(ctx);
    const searchProducts = await Promise.all(
      products.map((product) => getProductCard(ctx, product, sizeMaps)),
    );

    return {
      navigation,
      categories: categories.map((category) => ({
        _id: category._id,
        name: category.name,
        slug: category.slug,
      })),
      predefinedQueries: predefinedQueries
        .filter((item) => item.isActive)
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((item) => ({ _id: item._id, query: item.query })),
      searchProducts: searchProducts.map((product) => ({
        _id: product._id,
        name: product.name,
        slug: product.slug,
        description: product.description,
        basePrice: product.basePrice,
        effectivePrice: product.effectivePrice,
        discountAmount: product.discountAmount,
        thumbnailStorageId: product.thumbnailStorageId,
      })),
      marketing,
    };
  },
});

export const listProductSlugs = query({
  args: {},
  handler: async (ctx) =>
    (await listVisibleProducts(ctx)).map((product) => ({ slug: product.slug })),
});

export const getCatalog = query({
  args: {},
  handler: async (ctx) => {
    const [products, categories, colors, sizeMaps, allGroups] =
      await Promise.all([
        listVisibleProducts(ctx),
        getActiveCategories(ctx),
        ctx.db.query("platformColors").order("asc").take(100),
        getActiveSizeMaps(ctx),
        ctx.db
          .query("discountGroups")
          .withIndex("by_sortOrder")
          .order("asc")
          .take(200),
      ]);
    const cards = await Promise.all(
      products.map((product) => getProductCard(ctx, product, sizeMaps)),
    );
    const cardsById = new Map(cards.map((card) => [String(card._id), card]));
    const now = Date.now();
    const activeGroups = allGroups.filter(
      (group) =>
        group.isActive &&
        group.startTime <= now &&
        (group.endTime === undefined || group.endTime > now),
    );
    const groupedProductIds = new Set<string>();
    const saleGroups = await Promise.all(
      activeGroups.map(async (group) => {
        const rows = await ctx.db
          .query("discountGroupProducts")
          .withIndex("by_groupId_and_sortOrder", (q) =>
            q.eq("groupId", group._id),
          )
          .order("asc")
          .take(200);
        const groupProducts = rows
          .map((row) => {
            const card = cardsById.get(String(row.productId));
            if (card) groupedProductIds.add(String(row.productId));
            return card ?? null;
          })
          .filter((card): card is NonNullable<typeof card> => Boolean(card));
        return {
          _id: group._id,
          name: group.name,
          discountType: group.discountType,
          discountValue: group.discountValue,
          endTime: group.endTime ?? null,
          products: groupProducts,
        };
      }),
    );
    const individualSaleProducts = cards
      .filter(
        (card) =>
          card.discountAmount > 0 &&
          !groupedProductIds.has(String(card._id)) &&
          card.discountSource === "individual",
      )
      .sort((a, b) => {
        const aOrder = a.saleDiscountSortOrder ?? Number.MAX_SAFE_INTEGER;
        const bOrder = b.saleDiscountSortOrder ?? Number.MAX_SAFE_INTEGER;
        return aOrder === bOrder
          ? a._creationTime - b._creationTime
          : aOrder - bOrder;
      });

    return {
      products: cards,
      categories: categories.map((category) => ({
        _id: category._id,
        name: category.name,
        slug: category.slug,
      })),
      sizes: sizeMaps.activeSizes
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((size) => ({
          _id: size._id,
          name: size.name,
          measurements: size.measurements,
        })),
      colors: [...colors]
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((color) => ({
          _id: color._id,
          name: color.name,
          hexCode: color.hexCode,
        })),
      sale: { groups: saleGroups, individualProducts: individualSaleProducts },
    };
  },
});

export const getHomePage = query({
  args: {},
  handler: async (ctx) => {
    const [hero, splitImage, quotes, carouselItems, sections, sizeMaps, colors] =
      await Promise.all([
        ctx.db
          .query("landingPageImages")
          .withIndex("by_slot", (q) => q.eq("slot", "hero"))
          .first(),
        ctx.db
          .query("landingPageImages")
          .withIndex("by_slot", (q) => q.eq("slot", "splitImage"))
          .first(),
        ctx.db
          .query("landingPageQuotes")
          .withIndex("by_isActive", (q) => q.eq("isActive", true))
          .collect(),
        ctx.db
          .query("landingPageCarouselItems")
          .withIndex("by_isActive", (q) => q.eq("isActive", true))
          .collect(),
        ctx.db
          .query("landingPageProductSections")
          .withIndex("by_isActive", (q) => q.eq("isActive", true))
          .collect(),
        getActiveSizeMaps(ctx),
        ctx.db.query("platformColors").order("asc").take(100),
      ]);
    const productSections = await Promise.all(
      [...sections]
        .sort((a, b) => a.position - b.position)
        .map(async (section) => {
          const rows = await ctx.db
            .query("landingPageProductSectionItems")
            .withIndex("by_sectionId_and_sortOrder", (q) =>
              q.eq("sectionId", section._id),
            )
            .collect();
          const products = (
            await Promise.all(
              rows.map(async (row) => {
                const product = await ctx.db.get(row.productId);
                if (!product || !isProductVisible(product)) return null;
                return {
                  ...(await getProductCard(ctx, product, sizeMaps)),
                  sortOrder: row.sortOrder,
                };
              }),
            )
          )
            .filter((product): product is NonNullable<typeof product> =>
              Boolean(product),
            )
            .sort((a, b) => a.sortOrder - b.sortOrder);
          return {
            position: section.position,
            heading: section.heading,
            products,
          };
        }),
    );

    return {
      images: {
        hero: hero
          ? { storageId: hero.storageId, type: hero.type }
          : null,
        splitImage: splitImage
          ? { storageId: splitImage.storageId, type: splitImage.type }
          : null,
      },
      quotes,
      carousels: [...carouselItems]
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((item) => ({
          _id: item._id,
          storageId: item.storageId,
          text: item.text,
          url: item.url,
        })),
      productSections,
      colors: [...colors]
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((color) => ({ name: color.name, hexCode: color.hexCode })),
    };
  },
});

export const getProductPage = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const product = await ctx.db
      .query("products")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
    if (!product || !isProductVisible(product)) return null;

    const [sizeMaps, colors, tags, pricing, recommendationRows] =
      await Promise.all([
        getActiveSizeMaps(ctx),
        ctx.db.query("platformColors").order("asc").take(100),
        getProductTags(ctx, product._id),
        getEffectivePrice(ctx, product),
        ctx.db
          .query("productRecommendations")
          .withIndex("by_type", (q) => q.eq("type", "also_like"))
          .order("asc")
          .take(20),
      ]);
    const variants = await getProductVariants(ctx, product._id, sizeMaps);
    const recommendations = (
      await Promise.all(
        recommendationRows.map(async (row) => {
          if (!row.recommendedProductId) return null;
          const recommendation = await ctx.db.get(row.recommendedProductId);
          if (!recommendation || !isProductVisible(recommendation)) return null;
          return getProductCard(ctx, recommendation, sizeMaps);
        }),
      )
    ).filter((item): item is NonNullable<typeof item> => Boolean(item));

    return {
      product: {
        ...product,
        ...pricing,
        tags,
        variants,
      },
      sizes: sizeMaps.activeSizes
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((size) => ({
          _id: size._id,
          name: size.name,
          measurements: size.measurements,
        })),
      colors: [...colors]
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((color) => ({ name: color.name, hexCode: color.hexCode })),
      recommendations,
    };
  },
});

export const getProductStock = query({
  args: { productId: v.id("products") },
  handler: async (ctx, args) => {
    const sizeMaps = await getActiveSizeMaps(ctx);
    return (await getProductVariants(ctx, args.productId, sizeMaps)).map(
      (variant) => ({ _id: variant._id, stock: variant.stock }),
    );
  },
});
