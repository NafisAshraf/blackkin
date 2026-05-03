import { query, mutation } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { requirePermission } from "./lib/auth.helpers";
import type { QueryCtx, MutationCtx } from "./_generated/server";

// ─── Types ────────────────────────────────────────────────────────────────────

export type BundleTier = "tier2" | "tier3" | "none";

export interface BundleDiscountResult {
  bundleDiscountAmount: number;
  bundleDiscountFreeDelivery: boolean;
  bundleDiscountTier: BundleTier;
}

// ─── Shared computation helper (used from cart.ts and orders.ts) ──────────────

/**
 * Computes the bundle discount for a given cart.
 * - `totalQuantity`: sum of all cart item quantities
 * - `effectiveCartTotal`: subtotal after per-product discounts
 *
 * Applies at most one tier (highest eligible tier wins).
 * Returns zero discount when the feature is inactive or no tier matches.
 */
export async function computeBundleDiscount(
  ctx: QueryCtx | MutationCtx,
  totalQuantity: number,
  effectiveCartTotal: number,
): Promise<BundleDiscountResult> {
  const none: BundleDiscountResult = {
    bundleDiscountAmount: 0,
    bundleDiscountFreeDelivery: false,
    bundleDiscountTier: "none",
  };

  const config = await ctx.db.query("bundleDiscountConfig").first();
  if (!config || !config.isActive) return none;

  // Determine which tier applies (tier3 takes priority)
  let activeTier: typeof config.tier2 | typeof config.tier3 | null = null;
  let tierKey: BundleTier = "none";

  if (totalQuantity >= 3 && config.tier3.isActive) {
    activeTier = config.tier3;
    tierKey = "tier3";
  } else if (totalQuantity >= 2 && config.tier2.isActive) {
    activeTier = config.tier2;
    tierKey = "tier2";
  }

  if (!activeTier) return none;

  let discountAmount: number;
  if (activeTier.discountType === "percentage") {
    discountAmount = Math.round(
      (effectiveCartTotal * activeTier.discountAmount) / 100,
    );
  } else {
    discountAmount = activeTier.discountAmount;
  }

  // Clamp to cart total so discount never makes total negative
  discountAmount = Math.min(discountAmount, effectiveCartTotal);
  if (discountAmount <= 0) return none;

  return {
    bundleDiscountAmount: discountAmount,
    bundleDiscountFreeDelivery: activeTier.freeDelivery,
    bundleDiscountTier: tierKey,
  };
}

// ─── Convex API ───────────────────────────────────────────────────────────────

const tierValidator = v.object({
  isActive: v.boolean(),
  discountType: v.union(v.literal("percentage"), v.literal("flat")),
  discountAmount: v.number(),
  freeDelivery: v.boolean(),
});

export const get = query({
  args: {},
  returns: v.union(
    v.object({
      _id: v.id("bundleDiscountConfig"),
      _creationTime: v.number(),
      isActive: v.boolean(),
      tier2: tierValidator,
      tier3: tierValidator,
    }),
    v.null(),
  ),
  handler: async (ctx) => {
    return await ctx.db.query("bundleDiscountConfig").first();
  },
});

export const upsert = mutation({
  args: {
    isActive: v.boolean(),
    tier2: tierValidator,
    tier3: tierValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requirePermission(ctx, "settings");

    // Validate discount amounts
    for (const [label, tier] of [
      ["Tier 2", args.tier2],
      ["Tier 3", args.tier3],
    ] as const) {
      if (tier.discountAmount < 0) {
        throw new ConvexError(`${label} discount amount cannot be negative`);
      }
      if (tier.discountType === "percentage" && tier.discountAmount > 100) {
        throw new ConvexError(`${label} percentage cannot exceed 100`);
      }
    }

    const existing = await ctx.db.query("bundleDiscountConfig").first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        isActive: args.isActive,
        tier2: args.tier2,
        tier3: args.tier3,
      });
    } else {
      await ctx.db.insert("bundleDiscountConfig", {
        isActive: args.isActive,
        tier2: args.tier2,
        tier3: args.tier3,
      });
    }
    return null;
  },
});
