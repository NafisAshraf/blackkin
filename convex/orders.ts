import { query, mutation, internalMutation, internalQuery } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { requireAuth, requireAdmin } from "./lib/auth.helpers";
import { aggregateOrders } from "./lib/aggregates";
import { getProductDiscountedPrice } from "./lib/discounts";

const shippingAddressValidator = v.object({
  name: v.string(),
  phone: v.string(),
  addressLine1: v.string(),
  addressLine2: v.optional(v.string()),
  city: v.string(),
  postalCode: v.optional(v.string()),
});

const orderItemObject = v.object({
  _id: v.id("orderItems"),
  _creationTime: v.number(),
  orderId: v.id("orders"),
  productId: v.id("products"),
  variantId: v.id("productVariants"),
  productName: v.string(),
  size: v.string(),
  color: v.optional(v.string()),
  unitPrice: v.number(),
  quantity: v.number(),
  totalPrice: v.number(),
});

const orderObject = v.object({
  _id: v.id("orders"),
  _creationTime: v.number(),
  userId: v.id("users"),
  status: v.union(
    v.literal("pending"),
    v.literal("processed"),
    v.literal("shipped"),
    v.literal("delivered"),
    v.literal("cancelled")
  ),
  shippingAddress: shippingAddressValidator,
  subtotal: v.number(),
  discountAmount: v.number(),
  total: v.number(),
  paymentMethod: v.optional(v.string()),
  paymentStatus: v.union(
    v.literal("unpaid"),
    v.literal("paid"),
    v.literal("refunded")
  ),
  notes: v.optional(v.string()),
});

/**
 * Create an order from the current user's cart.
 * SERVER-SIDE: recalculates all prices, validates stock, decrements inventory.
 */
export const create = mutation({
  args: {
    shippingAddress: shippingAddressValidator,
    notes: v.optional(v.string()),
  },
  returns: v.id("orders"),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    // Load cart
    const cartItems = await ctx.db
      .query("cartItems")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .take(100);

    if (cartItems.length === 0) throw new ConvexError("Cart is empty");

    let subtotal = 0;
    let discountAmount = 0;

    // Validate all items and calculate prices server-side
    const enrichedItems = await Promise.all(
      cartItems.map(async (item) => {
        const product = await ctx.db.get(item.productId);
        if (!product || !product.isActive) {
          throw new ConvexError(`Product "${item.productId}" is no longer available`);
        }

        const variant = await ctx.db.get(item.variantId);
        if (!variant || variant.productId !== product._id) {
          throw new ConvexError("Variant not found");
        }
        if (variant.stock < item.quantity) {
          throw new ConvexError(
            `Insufficient stock for "${product.name}" (${variant.size})`
          );
        }

        // Server-side price calculation - never trust client
        const { discountedPrice, discountAmount: itemDiscount } =
          await getProductDiscountedPrice(ctx, product);

        const unitPrice = discountedPrice;
        const itemTotal = unitPrice * item.quantity;
        subtotal += product.basePrice * item.quantity;
        discountAmount += itemDiscount * item.quantity;

        return {
          productId: product._id,
          variantId: variant._id,
          productName: product.name,
          size: variant.size,
          color: variant.color,
          unitPrice,
          quantity: item.quantity,
          totalPrice: itemTotal,
          // For stock decrement
          variantDbId: variant._id,
          currentStock: variant.stock,
        };
      })
    );

    const total = subtotal - discountAmount;

    // Create the order
    const orderId = await ctx.db.insert("orders", {
      userId: user._id,
      status: "pending",
      shippingAddress: args.shippingAddress,
      subtotal,
      discountAmount,
      total,
      paymentStatus: "unpaid",
      notes: args.notes,
    });

    const order = await ctx.db.get(orderId);
    if (order) await aggregateOrders.insertIfDoesNotExist(ctx, order);

    // Insert order items and decrement color stock
    await Promise.all(
      enrichedItems.map(async (item) => {
        await ctx.db.insert("orderItems", {
          orderId,
          productId: item.productId,
          variantId: item.variantId,
          productName: item.productName,
          size: item.size,
          color: item.color,
          unitPrice: item.unitPrice,
          quantity: item.quantity,
          totalPrice: item.totalPrice,
        });

        // Decrement stock
        await ctx.db.patch(item.variantDbId, {
          stock: item.currentStock - item.quantity,
        });
      })
    );

    // Clear cart
    let done = false;
    while (!done) {
      const items = await ctx.db
        .query("cartItems")
        .withIndex("by_userId", (q) => q.eq("userId", user._id))
        .take(64);
      if (items.length === 0) { done = true; } else {
        await Promise.all(items.map((i) => ctx.db.delete(i._id)));
      }
    }

    return orderId;
  },
});

/** Customer: their own orders */
export const getMyOrders = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    return await ctx.db
      .query("orders")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .order("desc")
      .paginate(args.paginationOpts);
  },
});

/** Customer: single order with items (REACTIVE for live status) */
export const getMyOrder = query({
  args: { orderId: v.id("orders") },
  returns: v.union(
    v.object({
      order: orderObject,
      items: v.array(orderItemObject),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const order = await ctx.db.get(args.orderId);
    if (!order || order.userId !== user._id) return null;

    const items = await ctx.db
      .query("orderItems")
      .withIndex("by_orderId", (q) => q.eq("orderId", args.orderId))
      .take(50);

    return { order, items };
  },
});

/** Admin: all orders paginated */
export const listAll = query({
  args: {
    paginationOpts: paginationOptsValidator,
    status: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("processed"),
        v.literal("shipped"),
        v.literal("delivered"),
        v.literal("cancelled")
      )
    ),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    if (args.status) {
      return await ctx.db
        .query("orders")
        .withIndex("by_status", (q) => q.eq("status", args.status!))
        .order("desc")
        .paginate(args.paginationOpts);
    }
    return await ctx.db.query("orders").order("desc").paginate(args.paginationOpts);
  },
});

/** Admin: single order detail */
export const getById = query({
  args: { orderId: v.id("orders") },
  returns: v.union(
    v.object({
      order: orderObject,
      items: v.array(orderItemObject),
      customerName: v.optional(v.string()),
      customerEmail: v.string(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const order = await ctx.db.get(args.orderId);
    if (!order) return null;

    const items = await ctx.db
      .query("orderItems")
      .withIndex("by_orderId", (q) => q.eq("orderId", args.orderId))
      .take(50);

    const customer = await ctx.db.get(order.userId);

    return {
      order,
      items,
      customerName: customer?.name,
      customerEmail: customer?.email ?? customer?.phone ?? "",
    };
  },
});

/** Admin: update order status */
export const updateStatus = mutation({
  args: {
    orderId: v.id("orders"),
    status: v.union(
      v.literal("pending"),
      v.literal("processed"),
      v.literal("shipped"),
      v.literal("delivered"),
      v.literal("cancelled")
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const oldOrder = await ctx.db.get(args.orderId);
    if (!oldOrder) throw new ConvexError("Order not found");

    await ctx.db.patch(args.orderId, { status: args.status });
    const newOrder = await ctx.db.get(args.orderId);
    if (newOrder) await aggregateOrders.replaceOrInsert(ctx, oldOrder, newOrder);

    return null;
  },
});

/** Admin/Customer: update payment status (called after mock payment) */
export const updatePaymentStatus = mutation({
  args: {
    orderId: v.id("orders"),
    paymentStatus: v.union(
      v.literal("unpaid"),
      v.literal("paid"),
      v.literal("refunded")
    ),
    paymentMethod: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const order = await ctx.db.get(args.orderId);
    if (!order) throw new ConvexError("Order not found");

    // Only the order owner or admin can update payment
    if (order.userId !== user._id && user.role !== "admin") {
      throw new ConvexError("Unauthorized");
    }

    await ctx.db.patch(args.orderId, {
      paymentStatus: args.paymentStatus,
      ...(args.paymentMethod ? { paymentMethod: args.paymentMethod } : {}),
    });
    return null;
  },
});

// ─── INTERNAL: used by Convex payment actions / HTTP actions ─────────────────

/**
 * Create an order with an explicit userId — used from payment action
 * where ctx.auth is unavailable (action calls internal mutation).
 */
export const createInternal = internalMutation({
  args: {
    userId: v.id("users"),
    shippingAddress: shippingAddressValidator,
    notes: v.optional(v.string()),
  },
  returns: v.object({
    orderId: v.id("orders"),
    total: v.number(),
    subtotal: v.number(),
    discountAmount: v.number(),
    items: v.array(v.object({
      productName: v.string(),
      quantity: v.number(),
      unitPrice: v.number(),
      totalPrice: v.number(),
      size: v.string(),
      color: v.optional(v.string()),
      variantId: v.string(),
    })),
  }),
  handler: async (ctx, args) => {
    const { userId, shippingAddress, notes } = args;

    const cartItems = await ctx.db
      .query("cartItems")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .take(100);

    if (cartItems.length === 0) throw new ConvexError("Cart is empty");

    let subtotal = 0;
    let discountAmount = 0;

    const enrichedItems = await Promise.all(
      cartItems.map(async (item) => {
        const product = await ctx.db.get(item.productId);
        if (!product || !product.isActive) {
          throw new ConvexError(`Product "${item.productId}" is no longer available`);
        }
        const variant = await ctx.db.get(item.variantId);
        if (!variant || variant.productId !== product._id) {
          throw new ConvexError("Variant not found");
        }
        if (variant.stock < item.quantity) {
          throw new ConvexError(
            `Insufficient stock for "${product.name}" (${variant.size})`
          );
        }
        const { discountedPrice, discountAmount: itemDiscount } =
          await getProductDiscountedPrice(ctx, product);
        const unitPrice = discountedPrice;
        const itemTotal = unitPrice * item.quantity;
        subtotal += product.basePrice * item.quantity;
        discountAmount += itemDiscount * item.quantity;
        return {
          productId: product._id,
          variantId: variant._id,
          productName: product.name,
          size: variant.size,
          color: variant.color,
          unitPrice,
          quantity: item.quantity,
          totalPrice: itemTotal,
          variantDbId: variant._id,
          currentStock: variant.stock,
        };
      })
    );

    const total = subtotal - discountAmount;

    const orderId = await ctx.db.insert("orders", {
      userId,
      status: "pending",
      shippingAddress,
      subtotal,
      discountAmount,
      total,
      paymentStatus: "unpaid",
      paymentMethod: "sslcommerz",
      notes,
    });

    const order = await ctx.db.get(orderId);
    if (order) await aggregateOrders.insertIfDoesNotExist(ctx, order);

    await Promise.all(
      enrichedItems.map(async (item) => {
        await ctx.db.insert("orderItems", {
          orderId,
          productId: item.productId,
          variantId: item.variantId,
          productName: item.productName,
          size: item.size,
          color: item.color,
          unitPrice: item.unitPrice,
          quantity: item.quantity,
          totalPrice: item.totalPrice,
        });
        await ctx.db.patch(item.variantDbId, {
          stock: item.currentStock - item.quantity,
        });
      })
    );

    // Clear cart
    let done = false;
    while (!done) {
      const items = await ctx.db
        .query("cartItems")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .take(64);
      if (items.length === 0) { done = true; } else {
        await Promise.all(items.map((i) => ctx.db.delete(i._id)));
      }
    }

    return {
      orderId,
      total,
      subtotal,
      discountAmount,
      items: enrichedItems.map((i) => ({
        productName: i.productName,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        totalPrice: i.totalPrice,
        size: i.size,
        color: i.color,
        variantId: i.variantId as unknown as string,
      })),
    };
  },
});

/** No-auth payment status patch — safe because HTTP actions validate SSL signature */
export const updatePaymentStatusInternal = internalMutation({
  args: {
    orderId: v.id("orders"),
    paymentStatus: v.union(
      v.literal("unpaid"),
      v.literal("paid"),
      v.literal("refunded")
    ),
    paymentMethod: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.orderId);
    if (!order) return null;
    // Idempotent: don't downgrade from paid
    if (order.paymentStatus === "paid" && args.paymentStatus !== "paid") return null;
    await ctx.db.patch(args.orderId, {
      paymentStatus: args.paymentStatus,
      ...(args.paymentMethod ? { paymentMethod: args.paymentMethod } : {}),
    });
    return null;
  },
});

/** Internal query to get order + items for retry payment initiation */
export const getOrderWithItemsInternal = internalQuery({
  args: { orderId: v.id("orders") },
  handler: async (ctx, { orderId }) => {
    const order = await ctx.db.get(orderId);
    if (!order) return null;
    const items = await ctx.db
      .query("orderItems")
      .withIndex("by_orderId", (q) => q.eq("orderId", orderId))
      .take(50);
    const user = await ctx.db.get(order.userId);
    return { order, items, user };
  },
});

/** Rollback: cancel an order, reverse stock changes, and restore the cart */
export const cancelAndRestockInternal = internalMutation({
  args: { orderId: v.id("orders") },
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.orderId);
    if (!order) return;

    await ctx.db.patch(args.orderId, { status: "cancelled", paymentStatus: "unpaid" });

    const items = await ctx.db
      .query("orderItems")
      .withIndex("by_orderId", (q) => q.eq("orderId", args.orderId))
      .collect();

    for (const item of items) {
      // 1. restore stock
      const variant = await ctx.db.get(item.variantId);
      if (variant) {
        await ctx.db.patch(variant._id, { stock: variant.stock + item.quantity });
      }

      // 2. restore cart
      const existingCartItem = await ctx.db
        .query("cartItems")
        .withIndex("by_userId", (q) => q.eq("userId", order.userId))
        .filter((q) => q.eq(q.field("variantId"), item.variantId))
        .first();

      if (existingCartItem) {
        await ctx.db.patch(existingCartItem._id, {
          quantity: existingCartItem.quantity + item.quantity,
        });
      } else {
        await ctx.db.insert("cartItems", {
          userId: order.userId,
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity,
        });
      }
    }
  },
});
