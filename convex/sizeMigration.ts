import { query, mutation } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { Doc } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { requireAdmin } from "./lib/auth.helpers";
import {
  getActiveSizeMaps,
  getVariantSizeLabel,
  normalizeSizeName,
  variantCombinationKey,
} from "./lib/variantSizes";

async function getAllSizes(ctx: QueryCtx | MutationCtx) {
  return await ctx.db.query("platformSizes").order("asc").take(500);
}

function sizeNameForVariant(
  variant: Doc<"productVariants">,
  allSizeById: Map<string, Doc<"platformSizes">>,
) {
  if (variant.sizeId) {
    return allSizeById.get(String(variant.sizeId))?.name ?? variant.size;
  }
  return variant.size;
}

function variantMatchesName(
  variant: Doc<"productVariants">,
  name: string,
  allSizeById: Map<string, Doc<"platformSizes">>,
) {
  return (
    variant.isArchived !== true &&
    normalizeSizeName(sizeNameForVariant(variant, allSizeById)) ===
      normalizeSizeName(name)
  );
}

export const previewLegacySizeCleanup = query({
  args: {
    fromName: v.string(),
    toName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const [products, variants, cartItems, recommendations, orderItems, allSizes] =
      await Promise.all([
        ctx.db.query("products").order("asc").take(1000),
        ctx.db.query("productVariants").order("asc").take(5000),
        ctx.db.query("cartItems").order("asc").take(5000),
        ctx.db.query("productRecommendations").order("asc").take(5000),
        ctx.db.query("orderItems").order("asc").take(5000),
        getAllSizes(ctx),
      ]);

    const activeSizeMaps = await getActiveSizeMaps(ctx);
    const allSizeById = new Map<string, Doc<"platformSizes">>(
      allSizes.map((size: Doc<"platformSizes">) => [String(size._id), size]),
    );
    const productById = new Map<string, Doc<"products">>(
      products.map((product: Doc<"products">) => [String(product._id), product]),
    );

    const activeStockBySize: Record<string, number> = {};
    for (const variant of variants as Doc<"productVariants">[]) {
      const sizeLabel = getVariantSizeLabel(variant, activeSizeMaps);
      if (!sizeLabel) continue;
      activeStockBySize[sizeLabel] =
        (activeStockBySize[sizeLabel] ?? 0) + variant.stock;
    }

    const fromVariants = (variants as Doc<"productVariants">[]).filter(
      (variant) => variantMatchesName(variant, args.fromName, allSizeById),
    );
    const toVariants = args.toName
      ? (variants as Doc<"productVariants">[]).filter((variant) =>
          variantMatchesName(variant, args.toName!, allSizeById),
        )
      : [];
    const fromVariantIds = new Set(
      fromVariants.map((variant) => String(variant._id)),
    );

    const fromRows = fromVariants.map((variant) => ({
      variantId: variant._id,
      productId: variant.productId,
      productName:
        productById.get(String(variant.productId))?.name ?? "(deleted product)",
      color: variant.color,
      stock: variant.stock,
      matchingTargetExists:
        args.toName !== undefined &&
        toVariants.some(
          (target) =>
            target.productId === variant.productId &&
            (target.color ?? "") === (variant.color ?? ""),
        ),
    }));

    return {
      productCount: products.length,
      variantCount: variants.length,
      activeStockBySize,
      fromName: args.fromName,
      fromActiveCount: fromVariants.length,
      fromTotalStock: fromVariants.reduce(
        (sum, variant) => sum + variant.stock,
        0,
      ),
      fromRows,
      toName: args.toName,
      toActiveCount: toVariants.length,
      cartReferenceCount: cartItems.filter((item) =>
        fromVariantIds.has(String(item.variantId)),
      ).length,
      recommendationReferenceCount: recommendations.filter((item) =>
        item.recommendedVariantId
          ? fromVariantIds.has(String(item.recommendedVariantId))
          : false,
      ).length,
      orderReferenceCount: orderItems.filter((item) =>
        fromVariantIds.has(String(item.variantId)),
      ).length,
      canRun:
        fromVariants.length > 0 &&
        fromVariants.every((variant) => variant.stock === 0),
    };
  },
});

export const archiveZeroStockLegacySize = mutation({
  args: {
    fromName: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const [allSizes, variants] = await Promise.all([
      getAllSizes(ctx),
      ctx.db.query("productVariants").order("asc").take(5000),
    ]);
    const activeSizeMaps = await getActiveSizeMaps(ctx);
    const allSizeById = new Map<string, Doc<"platformSizes">>(
      allSizes.map((size: Doc<"platformSizes">) => [String(size._id), size]),
    );

    const fromVariants = (variants as Doc<"productVariants">[]).filter(
      (variant) => variantMatchesName(variant, args.fromName, allSizeById),
    );
    const variantsWithStock = fromVariants.filter((variant) => variant.stock > 0);
    if (variantsWithStock.length > 0) {
      throw new ConvexError(
        `Cannot archive ${args.fromName}; ${variantsWithStock.length} variants still have stock.`,
      );
    }

    const visibleAfterArchive = (variants as Doc<"productVariants">[])
      .filter(
        (variant) =>
          variant.isArchived !== true &&
          !fromVariants.some((from) => from._id === variant._id),
      )
      .map((variant) => {
        const sizeLabel = getVariantSizeLabel(variant, activeSizeMaps);
        const activeSize = sizeLabel
          ? activeSizeMaps.byName.get(normalizeSizeName(sizeLabel))
          : null;
        return activeSize
          ? { ...variant, size: activeSize.name, sizeId: activeSize._id }
          : null;
      })
      .filter((variant): variant is NonNullable<typeof variant> =>
        Boolean(variant),
      );

    const seen = new Set<string>();
    for (const variant of visibleAfterArchive) {
      const key = `${variant.productId}::${variantCombinationKey(variant)}`;
      if (seen.has(key)) {
        throw new ConvexError(
          "Cannot archive legacy size because duplicate active variant combinations already exist.",
        );
      }
      seen.add(key);
    }

    let backfilledCount = 0;
    for (const variant of variants as Doc<"productVariants">[]) {
      if (variant.isArchived === true) continue;
      if (fromVariants.some((from) => from._id === variant._id)) continue;

      const activeSize = activeSizeMaps.byName.get(
        normalizeSizeName(variant.size),
      );
      if (!activeSize) continue;

      if (variant.sizeId !== activeSize._id || variant.size !== activeSize.name) {
        await ctx.db.patch(variant._id, {
          sizeId: activeSize._id,
          size: activeSize.name,
        });
        backfilledCount++;
      }
    }

    const now = Date.now();
    await Promise.all(
      fromVariants.map((variant) =>
        ctx.db.patch(variant._id, {
          isArchived: true,
          archivedAt: now,
          archivedReason: `Archived legacy ${args.fromName} size variant`,
        }),
      ),
    );

    const fromSizeDocs = (allSizes as Doc<"platformSizes">[]).filter(
      (size) =>
        size.isArchived !== true &&
        normalizeSizeName(size.name) === normalizeSizeName(args.fromName),
    );
    await Promise.all(
      fromSizeDocs.map((size) =>
        ctx.db.patch(size._id, {
          isArchived: true,
          archivedAt: now,
          archivedReason: `Archived legacy ${args.fromName} size`,
        }),
      ),
    );

    return {
      archivedVariantCount: fromVariants.length,
      archivedSizeCount: fromSizeDocs.length,
      backfilledVariantCount: backfilledCount,
    };
  },
});
