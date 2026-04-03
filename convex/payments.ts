import { internalMutation, internalQuery, query } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { requireAuth } from "./lib/auth.helpers";

// ─── Shared validators ────────────────────────────────────────────────────────

const paymentStatusValidator = v.union(
  v.literal("initiated"),
  v.literal("valid"),
  v.literal("failed"),
  v.literal("cancelled"),
  v.literal("expired")
);

const paymentObject = v.object({
  _id: v.id("payments"),
  _creationTime: v.number(),
  orderId: v.id("orders"),
  tranId: v.string(),
  sessionKey: v.optional(v.string()),
  gatewayPageUrl: v.optional(v.string()),
  status: paymentStatusValidator,
  amount: v.number(),
  currency: v.string(),
  valId: v.optional(v.string()),
  bankTranId: v.optional(v.string()),
  cardType: v.optional(v.string()),
  cardNo: v.optional(v.string()),
  cardBrand: v.optional(v.string()),
  storeAmount: v.optional(v.number()),
  riskLevel: v.optional(v.string()),
  riskTitle: v.optional(v.string()),
});

// ─── Internal mutations ───────────────────────────────────────────────────────

/** Called from paymentActions after SSL session creation */
export const create = internalMutation({
  args: {
    orderId: v.id("orders"),
    tranId: v.string(),
    sessionKey: v.optional(v.string()),
    gatewayPageUrl: v.optional(v.string()),
    amount: v.number(),
    currency: v.string(),
  },
  returns: v.id("payments"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("payments", {
      ...args,
      status: "initiated",
    });
  },
});

/** Called from HTTP actions after IPN / success / fail / cancel */
export const updateStatus = internalMutation({
  args: {
    tranId: v.string(),
    status: paymentStatusValidator,
    valId: v.optional(v.string()),
    bankTranId: v.optional(v.string()),
    cardType: v.optional(v.string()),
    cardNo: v.optional(v.string()),
    cardBrand: v.optional(v.string()),
    storeAmount: v.optional(v.number()),
    riskLevel: v.optional(v.string()),
    riskTitle: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, { tranId, status, ...fields }) => {
    const payment = await ctx.db
      .query("payments")
      .withIndex("by_tranId", (q) => q.eq("tranId", tranId))
      .unique();

    if (!payment) {
      console.warn(`[payments.updateStatus] no payment found for tranId: ${tranId}`);
      return null;
    }

    // Idempotent: never downgrade from "valid"
    if (payment.status === "valid" && status !== "valid") return null;

    const update: Record<string, unknown> = { status };
    for (const [k, v] of Object.entries(fields)) {
      if (v !== undefined) update[k] = v;
    }

    await ctx.db.patch(payment._id, update);
    return null;
  },
});

// ─── Internal queries ─────────────────────────────────────────────────────────

export const getByTranId = internalQuery({
  args: { tranId: v.string() },
  returns: v.union(paymentObject, v.null()),
  handler: async (ctx, { tranId }) => {
    return await ctx.db
      .query("payments")
      .withIndex("by_tranId", (q) => q.eq("tranId", tranId))
      .unique();
  },
});

export const getByOrderId = internalQuery({
  args: { orderId: v.id("orders") },
  returns: v.array(paymentObject),
  handler: async (ctx, { orderId }) => {
    return await ctx.db
      .query("payments")
      .withIndex("by_orderId", (q) => q.eq("orderId", orderId))
      .order("desc")
      .take(20);
  },
});

// ─── Public query: customer views their own order's payments ─────────────────

export const getMyPaymentsForOrder = query({
  args: { orderId: v.id("orders") },
  returns: v.array(paymentObject),
  handler: async (ctx, { orderId }) => {
    const user = await requireAuth(ctx);
    const order = await ctx.db.get(orderId);
    if (!order || order.userId !== user._id) throw new ConvexError("Unauthorized");

    return await ctx.db
      .query("payments")
      .withIndex("by_orderId", (q) => q.eq("orderId", orderId))
      .order("desc")
      .take(20);
  },
});
