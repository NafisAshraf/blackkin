import { ConvexError } from "convex/values";
import { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

export type ActiveSizeMaps = {
  activeSizes: Doc<"platformSizes">[];
  byId: Map<string, Doc<"platformSizes">>;
  byName: Map<string, Doc<"platformSizes">>;
};

export type VariantInputWithSize = {
  id?: Id<"productVariants">;
  sizeId?: Id<"platformSizes">;
  size: string;
  color?: string;
  sku?: string;
  stock: number;
  priceOverride?: number;
};

export function normalizeSizeName(name: string) {
  return name.trim().toLowerCase();
}

export async function getActiveSizeMaps(
  ctx: QueryCtx | MutationCtx,
): Promise<ActiveSizeMaps> {
  const allSizes = (await ctx.db
    .query("platformSizes")
    .order("asc")
    .take(200)) as Doc<"platformSizes">[];
  const activeSizes = allSizes.filter((size) => size.isArchived !== true);

  return {
    activeSizes,
    byId: new Map(activeSizes.map((size) => [String(size._id), size])),
    byName: new Map(
      activeSizes.map((size) => [normalizeSizeName(size.name), size]),
    ),
  };
}

export function getVariantSizeDoc(
  variant: Pick<Doc<"productVariants">, "size" | "sizeId" | "isArchived">,
  sizeMaps: ActiveSizeMaps,
) {
  if (variant.isArchived === true) return null;

  if (variant.sizeId) {
    return sizeMaps.byId.get(String(variant.sizeId)) ?? null;
  }

  return sizeMaps.byName.get(normalizeSizeName(variant.size)) ?? null;
}

export function getVariantSizeLabel(
  variant: Pick<Doc<"productVariants">, "size" | "sizeId" | "isArchived">,
  sizeMaps: ActiveSizeMaps,
) {
  return getVariantSizeDoc(variant, sizeMaps)?.name ?? null;
}

export function isSelectableVariant(
  variant: Pick<Doc<"productVariants">, "size" | "sizeId" | "isArchived">,
  sizeMaps: ActiveSizeMaps,
) {
  return getVariantSizeDoc(variant, sizeMaps) !== null;
}

export function withResolvedVariantSize<T extends Doc<"productVariants">>(
  variant: T,
  sizeMaps: ActiveSizeMaps,
) {
  const size = getVariantSizeDoc(variant, sizeMaps);
  if (!size) return null;
  return {
    ...variant,
    size: size.name,
    sizeId: size._id,
  };
}

export function normalizeVariantInput(
  variant: VariantInputWithSize,
  sizeMaps: ActiveSizeMaps,
) {
  const size =
    (variant.sizeId ? sizeMaps.byId.get(String(variant.sizeId)) : null) ??
    sizeMaps.byName.get(normalizeSizeName(variant.size));

  if (!size) {
    throw new ConvexError(`Size "${variant.size}" is not configured`);
  }

  return {
    ...variant,
    sizeId: size._id,
    size: size.name,
  };
}

export function variantCombinationKey(variant: {
  sizeId?: Id<"platformSizes">;
  size: string;
  color?: string;
}) {
  const sizeKey = variant.sizeId
    ? `id:${String(variant.sizeId)}`
    : `name:${normalizeSizeName(variant.size)}`;
  return `${sizeKey}::${variant.color?.trim().toLowerCase() ?? ""}`;
}
