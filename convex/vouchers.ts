import {
  query,
  mutation,
  internalMutation,
  internalQuery,
  MutationCtx,
  QueryCtx,
} from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { requireAuth, requirePermission } from "./lib/auth.helpers";
import { Id } from "./_generated/dataModel";
import { getEffectivePrice } from "./lib/discounts";
import { internal } from "./_generated/api";

// ─── TYPES ───────────────────────────────────────────────────────────────────

const voucherPublicReturn = v.object({
  valid: v.boolean(),
  discountAmount: v.number(),
  errorMessage: v.optional(v.string()),
  // echo back the voucher meta so the UI can show helpful info
  voucherDescription: v.optional(v.string()),
  expiresAt: v.optional(v.number()),
  discountType: v.optional(v.union(v.literal("flat"), v.literal("percentage"))),
  discountPercent: v.optional(v.number()),
  maxDiscountAmount: v.optional(v.number()),
});

// 100 years in ms — effectively never expires
const FAR_FUTURE_MS = Date.now() + 100 * 365 * 24 * 60 * 60 * 1000;

// ─── INTERNAL HELPER: re-usable validation logic ─────────────────────────────

/**
 * Validates a voucher code against a set of conditions.
 * Returns the capped discount amount on success, throws ConvexError on failure.
 * Does NOT write to the database — safe to call from queries too.
 */
export async function validateVoucherLogic(
  ctx: QueryCtx | MutationCtx,
  code: string,
  effectiveCartTotal: number,
  userId: Id<"users"> | null,
  email: string,
): Promise<{
  voucherId: Id<"vouchers">;
  discountAmount: number;
  description: string | undefined;
  expiresAt: number;
  discountType: "flat" | "percentage";
  discountPercent: number | undefined;
  maxDiscountAmount: number | undefined;
}> {
  const now = Date.now();

  const voucher = await ctx.db
    .query("vouchers")
    .withIndex("by_code", (q) => q.eq("code", code.toUpperCase().trim()))
    .unique();

  if (!voucher) throw new ConvexError("Invalid voucher code.");
  if (!voucher.isActive)
    throw new ConvexError("This voucher is no longer active.");
  if (voucher.expiresAt <= now)
    throw new ConvexError("This voucher has expired.");
  if (voucher.maxUses > 0 && voucher.usedCount >= voucher.maxUses) {
    throw new ConvexError("This voucher has reached its usage limit.");
  }
  if (voucher.minSpend > 0 && effectiveCartTotal < voucher.minSpend) {
    throw new ConvexError(
      `A minimum spend of ৳${voucher.minSpend.toLocaleString()} is required to use this voucher.`,
    );
  }

  // Per-customer limit check
  if (voucher.maxUsesPerCustomer > 0) {
    let customerUses = 0;

    if (userId) {
      // Auth user — count by userId
      const usages = await ctx.db
        .query("voucherUsages")
        .withIndex("by_voucherId_and_userId", (q) =>
          q.eq("voucherId", voucher._id).eq("userId", userId),
        )
        .filter((q) => q.neq(q.field("status"), "cancelled"))
        .collect();
      customerUses = usages.length;
    } else if (email) {
      // Guest — count by email
      const usages = await ctx.db
        .query("voucherUsages")
        .withIndex("by_voucherId_and_email", (q) =>
          q
            .eq("voucherId", voucher._id)
            .eq("email", email.toLowerCase().trim()),
        )
        .filter((q) => q.neq(q.field("status"), "cancelled"))
        .collect();
      customerUses = usages.length;
    }

    if (customerUses >= voucher.maxUsesPerCustomer) {
      throw new ConvexError(
        "You have already used this voucher the maximum number of times.",
      );
    }
  }

  // Calculate discount amount based on type
  let discountAmount: number;
  if (voucher.discountType === "percentage") {
    // discountAmount field holds the percentage value (1–100)
    const raw = Math.floor((effectiveCartTotal * voucher.discountAmount) / 100);
    // Cap at maxDiscountAmount (required for percentage) and cart total
    const cap = voucher.maxDiscountAmount ?? Infinity;
    discountAmount = Math.min(raw, cap, effectiveCartTotal);
  } else {
    // flat: discountAmount is a fixed BDT amount, capped at cart total
    discountAmount = Math.min(voucher.discountAmount, effectiveCartTotal);
  }

  return {
    voucherId: voucher._id,
    discountAmount,
    description: voucher.description,
    expiresAt: voucher.expiresAt,
    discountType: voucher.discountType,
    discountPercent:
      voucher.discountType === "percentage"
        ? voucher.discountAmount
        : undefined,
    maxDiscountAmount: voucher.maxDiscountAmount,
  };
}

// ─── PUBLIC QUERY: Phase 1 cart preview (ZERO DB WRITES) ─────────────────────

/**
 * Validates a voucher code against the current user's cart.
 * Used in the checkout UI to show the discount preview before placing the order.
 * Never increments any counter — safe to call reactively.
 */
export const validateVoucher = query({
  args: { code: v.string() },
  returns: voucherPublicReturn,
  handler: async (ctx, args) => {
    if (!args.code.trim()) {
      return {
        valid: false,
        discountAmount: 0,
        errorMessage: "Please enter a voucher code.",
      };
    }

    let user;
    try {
      user = await requireAuth(ctx);
    } catch {
      return {
        valid: false,
        discountAmount: 0,
        errorMessage: "Please log in to apply a voucher.",
      };
    }

    // Compute effective cart total (subtotal − per-product discounts)
    const cartItems = await ctx.db
      .query("cartItems")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .take(100);

    if (cartItems.length === 0) {
      return {
        valid: false,
        discountAmount: 0,
        errorMessage: "Your cart is empty.",
      };
    }

    let effectiveCartTotal = 0;
    for (const item of cartItems) {
      const product = await ctx.db.get(item.productId);
      if (!product) continue;
      const { effectivePrice } = await getEffectivePrice(ctx, product);
      effectiveCartTotal += effectivePrice * item.quantity;
    }

    try {
      const result = await validateVoucherLogic(
        ctx,
        args.code,
        effectiveCartTotal,
        user._id,
        user.email ?? "",
      );
      return {
        valid: true,
        discountAmount: result.discountAmount,
        voucherDescription: result.description,
        expiresAt: result.expiresAt,
        discountType: result.discountType,
        discountPercent: result.discountPercent,
        maxDiscountAmount: result.maxDiscountAmount,
      };
    } catch (e) {
      const msg =
        e instanceof ConvexError ? (e.data as string) : "Invalid voucher code.";
      return { valid: false, discountAmount: 0, errorMessage: msg };
    }
  },
});

// ─── INTERNAL: apply voucher inside an order mutation ────────────────────────

/**
 * Called inside order creation mutations (COD & SSLCommerz).
 * Atomically validates, increments usedCount, and inserts a voucherUsages record.
 * Returns the actual BDT amount deducted (capped to cart total).
 *
 * isCod = true  → status "confirmed" immediately
 * isCod = false → status "pending", confirmed by paymentHttp on IPN
 */
export async function applyVoucherInMutation(
  ctx: MutationCtx,
  params: {
    code: string;
    effectiveCartTotal: number;
    userId: Id<"users"> | null;
    email: string | undefined;
    orderId: Id<"orders">;
    isCod: boolean;
  },
): Promise<number> {
  const { code, effectiveCartTotal, userId, email, orderId, isCod } = params;

  const { voucherId, discountAmount } = await validateVoucherLogic(
    ctx,
    code,
    effectiveCartTotal,
    userId,
    email ?? "",
  );

  // Atomically increment usedCount (race-safe because mutations are serialized)
  const voucher = await ctx.db.get(voucherId);
  if (!voucher) throw new ConvexError("Voucher not found.");
  await ctx.db.patch(voucherId, { usedCount: voucher.usedCount + 1 });

  // Record the usage
  await ctx.db.insert("voucherUsages", {
    voucherId,
    orderId,
    userId: userId ?? undefined,
    email: email ? email.toLowerCase().trim() : undefined,
    discountAmount,
    status: isCod ? "confirmed" : "pending",
  });

  return discountAmount;
}

// ─── INTERNAL: confirm usage (SSLCommerz IPN success) ────────────────────────

export const confirmVoucherUsage = internalMutation({
  args: { orderId: v.id("orders") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const usage = await ctx.db
      .query("voucherUsages")
      .withIndex("by_orderId", (q) => q.eq("orderId", args.orderId))
      .unique();

    if (!usage || usage.status !== "pending") return null;
    await ctx.db.patch(usage._id, { status: "confirmed" });
    return null;
  },
});

// ─── INTERNAL: release voucher (order cancelled) ─────────────────────────────

/**
 * Decrements usedCount on the voucher and marks the usage record as "cancelled".
 * Called from cancelAndRestockInternal and updateStatus (→ cancelled/deleted).
 * Safe to call even if no voucher was applied to the order.
 */
export const releaseVoucherForOrder = internalMutation({
  args: { orderId: v.id("orders") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const usage = await ctx.db
      .query("voucherUsages")
      .withIndex("by_orderId", (q) => q.eq("orderId", args.orderId))
      .unique();

    if (!usage || usage.status === "cancelled") return null;

    // Decrement usedCount
    const voucher = await ctx.db.get(usage.voucherId);
    if (voucher) {
      await ctx.db.patch(voucher._id, {
        usedCount: Math.max(0, voucher.usedCount - 1),
      });
    }

    await ctx.db.patch(usage._id, { status: "cancelled" });
    return null;
  },
});

// ─── INTERNAL QUERY: get usage by orderId ────────────────────────────────────

export const getUsageByOrderId = internalQuery({
  args: { orderId: v.id("orders") },
  returns: v.union(
    v.object({
      _id: v.id("voucherUsages"),
      voucherId: v.id("vouchers"),
      orderId: v.id("orders"),
      userId: v.optional(v.id("users")),
      email: v.optional(v.string()),
      discountAmount: v.number(),
      status: v.union(
        v.literal("pending"),
        v.literal("confirmed"),
        v.literal("cancelled"),
      ),
      _creationTime: v.number(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const usage = await ctx.db
      .query("voucherUsages")
      .withIndex("by_orderId", (q) => q.eq("orderId", args.orderId))
      .unique();
    return usage ?? null;
  },
});

// ─── ADMIN: CRUD ──────────────────────────────────────────────────────────────

const voucherAdminObject = v.object({
  _id: v.id("vouchers"),
  _creationTime: v.number(),
  code: v.string(),
  description: v.optional(v.string()),
  discountType: v.union(v.literal("flat"), v.literal("percentage")),
  discountAmount: v.number(),
  maxDiscountAmount: v.optional(v.number()),
  isGlobal: v.boolean(),
  minSpend: v.number(),
  expiresAt: v.number(),
  maxUses: v.number(),
  usedCount: v.number(),
  maxUsesPerCustomer: v.number(),
  isActive: v.boolean(),
});

export const adminList = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "vouchers");
    return await ctx.db
      .query("vouchers")
      .order("desc")
      .paginate(args.paginationOpts);
  },
});

export const adminGetById = query({
  args: { voucherId: v.id("vouchers") },
  returns: v.union(
    v.object({
      voucher: voucherAdminObject,
      recentUsages: v.array(
        v.object({
          _id: v.id("voucherUsages"),
          _creationTime: v.number(),
          orderId: v.id("orders"),
          email: v.optional(v.string()),
          discountAmount: v.number(),
          status: v.union(
            v.literal("pending"),
            v.literal("confirmed"),
            v.literal("cancelled"),
          ),
        }),
      ),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    await requirePermission(ctx, "vouchers");
    const voucher = await ctx.db.get(args.voucherId);
    if (!voucher) return null;

    const recentUsages = await ctx.db
      .query("voucherUsages")
      .withIndex("by_voucherId", (q) => q.eq("voucherId", args.voucherId))
      .order("desc")
      .take(20);

    return {
      voucher,
      recentUsages: recentUsages.map((u) => ({
        _id: u._id,
        _creationTime: u._creationTime,
        orderId: u.orderId,
        email: u.email,
        discountAmount: u.discountAmount,
        status: u.status,
      })),
    };
  },
});

export const adminCreate = mutation({
  args: {
    code: v.string(),
    description: v.optional(v.string()),
    discountType: v.union(v.literal("flat"), v.literal("percentage")),
    discountAmount: v.number(),
    maxDiscountAmount: v.optional(v.number()),
    isGlobal: v.boolean(),
    minSpend: v.number(),
    expiresAt: v.number(),
    maxUses: v.number(),
    maxUsesPerCustomer: v.number(),
    isActive: v.boolean(),
  },
  returns: v.id("vouchers"),
  handler: async (ctx, args) => {
    await requirePermission(ctx, "vouchers");

    const code = args.code.toUpperCase().trim();
    if (!code) throw new ConvexError("Voucher code cannot be empty.");

    // WELCOME is a reserved system voucher — cannot be created manually
    if (code === "WELCOME")
      throw new ConvexError(
        "WELCOME is a reserved system voucher. Configure it from the Welcome Voucher settings card.",
      );

    if (args.discountType === "flat") {
      if (args.discountAmount <= 0)
        throw new ConvexError("Discount amount must be positive.");
    } else {
      // percentage
      if (args.discountAmount <= 0 || args.discountAmount > 100)
        throw new ConvexError("Percentage discount must be between 1 and 100.");
      if (!args.maxDiscountAmount || args.maxDiscountAmount <= 0)
        throw new ConvexError(
          "A maximum discount amount (BDT cap) is required for percentage vouchers.",
        );
    }
    if (args.minSpend < 0)
      throw new ConvexError("Minimum spend cannot be negative.");
    if (args.maxUses < 0) throw new ConvexError("Max uses cannot be negative.");
    if (args.maxUsesPerCustomer < 0)
      throw new ConvexError("Max uses per customer cannot be negative.");

    // Enforce unique code
    const existing = await ctx.db
      .query("vouchers")
      .withIndex("by_code", (q) => q.eq("code", code))
      .unique();
    if (existing)
      throw new ConvexError(`A voucher with code "${code}" already exists.`);

    return await ctx.db.insert("vouchers", {
      code,
      description: args.description,
      discountType: args.discountType,
      discountAmount: args.discountAmount,
      maxDiscountAmount:
        args.discountType === "percentage" ? args.maxDiscountAmount : undefined,
      isGlobal: args.isGlobal,
      minSpend: args.minSpend,
      expiresAt: args.expiresAt,
      maxUses: args.maxUses,
      usedCount: 0,
      maxUsesPerCustomer: args.maxUsesPerCustomer,
      isActive: args.isActive,
    });
  },
});

export const adminUpdate = mutation({
  args: {
    voucherId: v.id("vouchers"),
    description: v.optional(v.string()),
    discountType: v.union(v.literal("flat"), v.literal("percentage")),
    discountAmount: v.number(),
    maxDiscountAmount: v.optional(v.number()),
    isGlobal: v.boolean(),
    minSpend: v.number(),
    expiresAt: v.number(),
    maxUses: v.number(),
    maxUsesPerCustomer: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requirePermission(ctx, "vouchers");

    const voucher = await ctx.db.get(args.voucherId);
    if (!voucher) throw new ConvexError("Voucher not found.");

    // WELCOME: lock discountType=percentage, isGlobal=true, maxUsesPerCustomer=1
    if (voucher.code === "WELCOME") {
      throw new ConvexError(
        "Use the Welcome Voucher settings to configure the WELCOME voucher.",
      );
    }

    if (args.discountType === "flat") {
      if (args.discountAmount <= 0)
        throw new ConvexError("Discount amount must be positive.");
    } else {
      if (args.discountAmount <= 0 || args.discountAmount > 100)
        throw new ConvexError("Percentage discount must be between 1 and 100.");
      if (!args.maxDiscountAmount || args.maxDiscountAmount <= 0)
        throw new ConvexError(
          "A maximum discount amount (BDT cap) is required for percentage vouchers.",
        );
    }
    if (args.minSpend < 0)
      throw new ConvexError("Minimum spend cannot be negative.");

    await ctx.db.patch(args.voucherId, {
      description: args.description,
      discountType: args.discountType,
      discountAmount: args.discountAmount,
      maxDiscountAmount:
        args.discountType === "percentage" ? args.maxDiscountAmount : undefined,
      isGlobal: args.isGlobal,
      minSpend: args.minSpend,
      expiresAt: args.expiresAt,
      maxUses: args.maxUses,
      maxUsesPerCustomer: args.maxUsesPerCustomer,
    });
    return null;
  },
});

export const adminToggleActive = mutation({
  args: { voucherId: v.id("vouchers") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requirePermission(ctx, "vouchers");
    const voucher = await ctx.db.get(args.voucherId);
    if (!voucher) throw new ConvexError("Voucher not found.");
    await ctx.db.patch(args.voucherId, { isActive: !voucher.isActive });
    return null;
  },
});

export const adminDelete = mutation({
  args: { voucherId: v.id("vouchers") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requirePermission(ctx, "vouchers");
    const voucher = await ctx.db.get(args.voucherId);
    if (!voucher) throw new ConvexError("Voucher not found.");
    if (voucher.code === "WELCOME")
      throw new ConvexError(
        "The WELCOME system voucher cannot be deleted. You can deactivate it instead.",
      );
    if (voucher.usedCount > 0) {
      throw new ConvexError(
        "Cannot delete a voucher that has been used. Deactivate it instead.",
      );
    }
    await ctx.db.delete(args.voucherId);
    return null;
  },
});

// ─── INTERNAL: seed the WELCOME voucher if it doesn't exist ──────────────────

export const ensureWelcomeVoucher = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const existing = await ctx.db
      .query("vouchers")
      .withIndex("by_code", (q) => q.eq("code", "WELCOME"))
      .unique();
    if (existing) return null; // already exists, nothing to do

    await ctx.db.insert("vouchers", {
      code: "WELCOME",
      description: "Welcome gift for new customers — use it once!",
      discountType: "percentage",
      discountAmount: 10, // 10%
      maxDiscountAmount: 100, // max ৳100 off
      isGlobal: true,
      minSpend: 0,
      expiresAt: FAR_FUTURE_MS,
      maxUses: 0, // unlimited global uses
      usedCount: 0,
      maxUsesPerCustomer: 1, // each user can use it once
      isActive: true,
    });
    return null;
  },
});

// ─── ADMIN: update WELCOME voucher config ────────────────────────────────────

export const adminUpdateWelcomeConfig = mutation({
  args: {
    discountAmount: v.number(), // percentage value 1–100
    maxDiscountAmount: v.number(), // BDT cap
    minSpend: v.number(),
    isActive: v.boolean(),
    description: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requirePermission(ctx, "vouchers");

    if (args.discountAmount <= 0 || args.discountAmount > 100)
      throw new ConvexError("Percentage must be between 1 and 100.");
    if (args.maxDiscountAmount <= 0)
      throw new ConvexError("Max discount amount must be positive.");
    if (args.minSpend < 0)
      throw new ConvexError("Minimum spend cannot be negative.");

    let existing = await ctx.db
      .query("vouchers")
      .withIndex("by_code", (q) => q.eq("code", "WELCOME"))
      .unique();

    if (!existing) {
      // Seed it first, then patch
      await ctx.db.insert("vouchers", {
        code: "WELCOME",
        description:
          args.description ?? "Welcome gift for new customers — use it once!",
        discountType: "percentage",
        discountAmount: args.discountAmount,
        maxDiscountAmount: args.maxDiscountAmount,
        isGlobal: true,
        minSpend: args.minSpend,
        expiresAt: FAR_FUTURE_MS,
        maxUses: 0,
        usedCount: 0,
        maxUsesPerCustomer: 1,
        isActive: args.isActive,
      });
      return null;
    }

    await ctx.db.patch(existing._id, {
      discountAmount: args.discountAmount,
      maxDiscountAmount: args.maxDiscountAmount,
      minSpend: args.minSpend,
      isActive: args.isActive,
      description: args.description,
      // locked fields — never changed:
      discountType: "percentage",
      isGlobal: true,
      maxUsesPerCustomer: 1,
    });
    return null;
  },
});

// ─── PUBLIC: get global vouchers for customer profile ────────────────────────

export const getGlobalVouchers = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("vouchers"),
      code: v.string(),
      description: v.optional(v.string()),
      discountType: v.union(v.literal("flat"), v.literal("percentage")),
      discountAmount: v.number(),
      maxDiscountAmount: v.optional(v.number()),
      minSpend: v.number(),
      expiresAt: v.number(),
      maxUsesPerCustomer: v.number(),
      userUsageCount: v.number(), // how many times THIS user has used it (non-cancelled)
    }),
  ),
  handler: async (ctx) => {
    let userId: Id<"users"> | null = null;
    try {
      const user = await requireAuth(ctx);
      userId = user._id;
    } catch {
      // Not authenticated — still show vouchers but no usage count
    }

    const now = Date.now();
    const vouchers = await ctx.db
      .query("vouchers")
      .withIndex("by_isActive", (q) => q.eq("isActive", true))
      .collect();

    const globalVouchers = vouchers.filter(
      (v) => v.isGlobal && v.expiresAt > now,
    );

    const result = await Promise.all(
      globalVouchers.map(async (voucher) => {
        let userUsageCount = 0;
        if (userId) {
          const usages = await ctx.db
            .query("voucherUsages")
            .withIndex("by_voucherId_and_userId", (q) =>
              q.eq("voucherId", voucher._id).eq("userId", userId!),
            )
            .filter((q) => q.neq(q.field("status"), "cancelled"))
            .collect();
          userUsageCount = usages.length;
        }
        return {
          _id: voucher._id,
          code: voucher.code,
          description: voucher.description,
          discountType: voucher.discountType,
          discountAmount: voucher.discountAmount,
          maxDiscountAmount: voucher.maxDiscountAmount,
          minSpend: voucher.minSpend,
          expiresAt: voucher.expiresAt,
          maxUsesPerCustomer: voucher.maxUsesPerCustomer,
          userUsageCount,
        };
      }),
    );

    return result;
  },
});
