import { Doc } from "../_generated/dataModel";
import { QueryCtx, MutationCtx } from "../_generated/server";

/**
 * Pure function: checks if a product is visible on the storefront.
 * No cron jobs — "scheduled" products become visible dynamically once their time passes.
 */
export function isProductVisible(
  product: Doc<"products">,
  now: number = Date.now()
): boolean {
  if (product.status === "active") return true;
  if (
    product.status === "scheduled" &&
    product.scheduledPublishTime !== undefined &&
    product.scheduledPublishTime <= now
  )
    return true;
  return false;
}

/**
 * Checks whether the product's individual sale is currently active.
 */
function isIndividualSaleActive(
  product: Doc<"products">,
  now: number
): boolean {
  if (!product.saleEnabled) return false;
  if (product.salePrice === undefined) return false;

  // Check start condition
  if (product.saleStartMode === "custom") {
    if (
      product.saleStartTime === undefined ||
      product.saleStartTime > now
    )
      return false;
  }

  // Check end condition
  if (product.saleEndMode === "custom") {
    if (
      product.saleEndTime !== undefined &&
      product.saleEndTime <= now
    )
      return false;
  }

  return true;
}

/**
 * Computes the effective (display) price for a product.
 *
 * Priority:
 *   1. Discount group (highest) — if product is in an active group, group discount applies.
 *      Among multiple active groups, the one yielding the lowest price wins.
 *   2. Individual sale — only if no active group discount.
 *
 * When a group expires/is deactivated, the individual sale naturally returns.
 */
export async function getEffectivePrice(
  ctx: QueryCtx | MutationCtx,
  product: Doc<"products">
): Promise<{
  effectivePrice: number;
  discountAmount: number;
  discountSource: "group" | "individual" | null;
  discountGroupName: string | null;
  discountEndTime: number | null;
}> {
  const now = Date.now();
  const basePrice = product.basePrice;

  // ── 1. Check discount groups ───────────────────────────────
  const groupProductRows = await ctx.db
    .query("discountGroupProducts")
    .withIndex("by_productId", (q) => q.eq("productId", product._id))
    .take(20);

  let bestGroupPrice = basePrice;
  let bestGroupName: string | null = null;
  let bestGroupEndTime: number | null = null;

  for (const row of groupProductRows) {
    const group = await ctx.db.get(row.groupId);
    if (!group) continue;
    if (!group.isActive) continue;
    if (group.startTime > now) continue;
    if (group.endTime !== undefined && group.endTime <= now) continue;

    const groupPrice = computeGroupDiscount(basePrice, group);
    if (groupPrice < bestGroupPrice) {
      bestGroupPrice = groupPrice;
      bestGroupName = group.name;
      bestGroupEndTime = group.endTime ?? null;
    }
  }

  if (bestGroupName !== null) {
    const discountAmount = basePrice - bestGroupPrice;
    return {
      effectivePrice: bestGroupPrice,
      discountAmount,
      discountSource: "group",
      discountGroupName: bestGroupName,
      discountEndTime: bestGroupEndTime,
    };
  }

  // ── 2. Check individual sale ───────────────────────────────
  if (isIndividualSaleActive(product, now)) {
    const salePrice = product.salePrice!;
    const effectivePrice = Math.max(0, salePrice);
    const discountAmount = Math.max(0, basePrice - effectivePrice);
    return {
      effectivePrice,
      discountAmount,
      discountSource: "individual",
      discountGroupName: null,
      discountEndTime:
        product.saleEndMode === "custom" ? (product.saleEndTime ?? null) : null,
    };
  }

  // ── 3. No discount ────────────────────────────────────────
  return {
    effectivePrice: basePrice,
    discountAmount: 0,
    discountSource: null,
    discountGroupName: null,
    discountEndTime: null,
  };
}

function computeGroupDiscount(
  basePrice: number,
  group: Doc<"discountGroups">
): number {
  if (group.discountType === "percentage") {
    const off = Math.round((basePrice * group.discountValue) / 100);
    return Math.max(0, basePrice - off);
  }
  // fixed amount off
  return Math.max(0, basePrice - group.discountValue);
}
