import { query, mutation, internalMutation, internalQuery, MutationCtx } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { requireAuth, requirePermission, requireOrderAction } from "./lib/auth.helpers";
import { aggregateOrders } from "./lib/aggregates";
import { getEffectivePrice, isProductVisible } from "./lib/discounts";
import { orderStatusValidator, ORDER_STATUS_LIST, type OrderStatus } from "./lib/validators";
import { r2 } from "./r2";
import { Id } from "./_generated/dataModel";

const shippingAddressValidator = v.object({
  name: v.string(),
  phone: v.string(),
  email: v.optional(v.string()),
  address: v.string(),
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
  status: orderStatusValidator,
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
  courierName: v.optional(v.string()),
  deliveryCost: v.optional(v.number()),
  adminNote: v.optional(v.string()),
  confirmedBy: v.optional(v.object({ userId: v.id("users"), name: v.string(), at: v.number() })),
  deletedBy:   v.optional(v.object({ userId: v.id("users"), name: v.string(), at: v.number() })),
  cancelledBy: v.optional(v.object({ userId: v.id("users"), name: v.string(), at: v.number() })),
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
        if (!product || !isProductVisible(product)) {
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
        const { effectivePrice: discountedPrice, discountAmount: itemDiscount } =
          await getEffectivePrice(ctx, product);

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
      status: "new",
      shippingAddress: { ...args.shippingAddress, email: user.email },
      subtotal,
      discountAmount,
      total,
      paymentStatus: "unpaid",
      notes: args.notes,
    });

    const order = await ctx.db.get(orderId);
    if (order) await aggregateOrders.insertIfDoesNotExist(ctx, order);

    // Update orderStatusAmounts for "new"
    const existing = await ctx.db
      .query("orderStatusAmounts")
      .withIndex("by_status", (q) => q.eq("status", "new"))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, { totalAmount: existing.totalAmount + total });
    } else {
      await ctx.db.insert("orderStatusAmounts", { status: "new", totalAmount: total });
    }

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
    status: v.optional(orderStatusValidator),
  },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "orders");
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
    await requirePermission(ctx, "orders");
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
    status: orderStatusValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const admin = await requirePermission(ctx, "orders");

    const oldOrder = await ctx.db.get(args.orderId);
    if (!oldOrder) throw new ConvexError("Order not found");

    // Server-side allowedStatuses enforcement
    if (admin.role !== "superadmin") {
      const allowed = admin.permissions?.orders?.allowedStatuses ?? [];
      if (!allowed.includes(args.status)) throw new ConvexError("Unauthorized");
    }

    // Action-level permission for terminal statuses
    if (admin.role !== "superadmin") {
      if (args.status === "completed" && !admin.permissions?.orders?.canConfirm) throw new ConvexError("Unauthorized");
      if (args.status === "deleted" && !admin.permissions?.orders?.canDelete) throw new ConvexError("Unauthorized");
    }

    // Audit trail merged into the status patch
    const actorName = admin.name ?? admin.email ?? "Unknown";
    const actor = { userId: admin._id, name: actorName, at: Date.now() };
    const auditPatch: Record<string, unknown> = {};
    if (args.status === "completed") auditPatch.confirmedBy = actor;
    if (args.status === "deleted")   auditPatch.deletedBy   = actor;
    if (args.status === "cancelled") auditPatch.cancelledBy = actor;

    await ctx.db.patch(args.orderId, { status: args.status, ...auditPatch });
    const newOrder = await ctx.db.get(args.orderId);
    if (newOrder) await aggregateOrders.replaceOrInsert(ctx, oldOrder, newOrder);

    // Decrement old status amount
    const oldAmountDoc = await ctx.db
      .query("orderStatusAmounts")
      .withIndex("by_status", (q) => q.eq("status", oldOrder.status))
      .unique();
    if (oldAmountDoc) {
      await ctx.db.patch(oldAmountDoc._id, { totalAmount: Math.max(0, oldAmountDoc.totalAmount - oldOrder.total) });
    }
    // Increment new status amount
    const newAmountDoc = await ctx.db
      .query("orderStatusAmounts")
      .withIndex("by_status", (q) => q.eq("status", args.status))
      .unique();
    if (newAmountDoc) {
      await ctx.db.patch(newAmountDoc._id, { totalAmount: newAmountDoc.totalAmount + oldOrder.total });
    } else {
      await ctx.db.insert("orderStatusAmounts", { status: args.status, totalAmount: oldOrder.total });
    }

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

    const user = await ctx.db.get(userId);

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
        if (!product || !isProductVisible(product)) {
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
        const { effectivePrice: discountedPrice, discountAmount: itemDiscount } =
          await getEffectivePrice(ctx, product);
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
      status: "new",
      shippingAddress: { ...shippingAddress, email: user?.email },
      subtotal,
      discountAmount,
      total,
      paymentStatus: "unpaid",
      paymentMethod: "sslcommerz",
      notes,
    });

    const order = await ctx.db.get(orderId);
    if (order) await aggregateOrders.insertIfDoesNotExist(ctx, order);

    // Update orderStatusAmounts for "new"
    const existing = await ctx.db
      .query("orderStatusAmounts")
      .withIndex("by_status", (q) => q.eq("status", "new"))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, { totalAmount: existing.totalAmount + total });
    } else {
      await ctx.db.insert("orderStatusAmounts", { status: "new", totalAmount: total });
    }

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

// ─── ADMIN: Status counts ─────────────────────────────────────────────────────

export const getStatusCounts = query({
  args: {},
  returns: v.array(v.object({
    status: v.string(),
    count: v.number(),
    totalAmount: v.number(),
  })),
  handler: async (ctx) => {
    await requirePermission(ctx, "orders");
    const statuses: OrderStatus[] = ORDER_STATUS_LIST;
    const results = await Promise.all(
      statuses.map(async (status) => {
        const count = await aggregateOrders.count(ctx, { namespace: status });
        const amountDoc = await ctx.db
          .query("orderStatusAmounts")
          .withIndex("by_status", (q) => q.eq("status", status))
          .unique();
        return { status, count, totalAmount: amountDoc?.totalAmount ?? 0 };
      })
    );
    return results;
  },
});

// ─── ADMIN: Enriched paginated orders ────────────────────────────────────────

export const listAllEnriched = query({
  args: {
    paginationOpts: paginationOptsValidator,
    status: v.optional(orderStatusValidator),
    excludeStatuses: v.optional(v.array(orderStatusValidator)),
  },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "orders");
    const page = args.status
      ? await ctx.db.query("orders").withIndex("by_status", (q) => q.eq("status", args.status!)).order("desc").paginate(args.paginationOpts)
      : await ctx.db.query("orders").order("desc").paginate(args.paginationOpts);

    const exclude = new Set(args.excludeStatuses ?? []);
    const filteredPage = exclude.size > 0
      ? { ...page, page: page.page.filter((o) => !exclude.has(o.status)) }
      : page;

    const enriched = await Promise.all(filteredPage.page.map(async (order) => {
      const customer = await ctx.db.get(order.userId);
      const items = await ctx.db.query("orderItems").withIndex("by_orderId", (q) => q.eq("orderId", order._id)).take(20);
      const thumbnails = await Promise.all(items.map(async (item) => {
        const product = await ctx.db.get(item.productId);
        let imageUrl: string | null = null;
        if (product) {
          const firstImage = product.media.find((m) => m.type === "image");
          if (firstImage) imageUrl = await r2.getUrl(firstImage.storageId);
        }
        return {
          productId: item.productId,
          productName: item.productName,
          imageUrl,
          quantity: item.quantity,
          size: item.size,
          color: item.color,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
        };
      }));
      return {
        _id: order._id,
        _creationTime: order._creationTime,
        userId: order.userId,
        status: order.status,
        total: order.total,
        subtotal: order.subtotal,
        discountAmount: order.discountAmount,
        deliveryCost: order.deliveryCost,
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
        notes: order.notes,
        adminNote: order.adminNote,
        courierName: order.courierName,
        shippingAddress: order.shippingAddress,
        confirmedBy: order.confirmedBy,
        deletedBy: order.deletedBy,
        cancelledBy: order.cancelledBy,
        customerName: customer?.name,
        customerPhone: customer?.phone,
        customerEmail: customer?.email,
        productThumbnails: thumbnails,
      };
    }));
    return { ...filteredPage, page: enriched };
  },
});

// ─── ADMIN: Courier update ────────────────────────────────────────────────────

export const updateCourier = mutation({
  args: { orderId: v.id("orders"), courierName: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requirePermission(ctx, "orders");
    const order = await ctx.db.get(args.orderId);
    if (!order) throw new ConvexError("Order not found");
    await ctx.db.patch(args.orderId, { courierName: args.courierName });
    return null;
  },
});

// ─── ADMIN: Order notes ───────────────────────────────────────────────────────

export const addNote = mutation({
  args: { orderId: v.id("orders"), text: v.string() },
  returns: v.id("orderNotes"),
  handler: async (ctx, args) => {
    const admin = await requirePermission(ctx, "orders");
    const order = await ctx.db.get(args.orderId);
    if (!order) throw new ConvexError("Order not found");
    const id = await ctx.db.insert("orderNotes", {
      orderId: args.orderId,
      adminId: admin._id,
      adminName: admin.name ?? "Admin",
      text: args.text.trim(),
    });
    return id;
  },
});

export const deleteNote = mutation({
  args: { noteId: v.id("orderNotes") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requirePermission(ctx, "orders");
    await ctx.db.delete(args.noteId);
    return null;
  },
});

export const getNotes = query({
  args: { orderId: v.id("orders") },
  returns: v.array(v.object({
    _id: v.id("orderNotes"),
    _creationTime: v.number(),
    orderId: v.id("orders"),
    adminId: v.id("users"),
    adminName: v.string(),
    text: v.string(),
  })),
  handler: async (ctx, args) => {
    await requirePermission(ctx, "orders");
    return await ctx.db
      .query("orderNotes")
      .withIndex("by_orderId", (q) => q.eq("orderId", args.orderId))
      .order("asc")
      .take(100);
  },
});

// ─── ADMIN: Single admin note (replaces chat-based notes) ─────────────────────

export const updateAdminNote = mutation({
  args: { orderId: v.id("orders"), adminNote: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requirePermission(ctx, "orders");
    const order = await ctx.db.get(args.orderId);
    if (!order) throw new ConvexError("Order not found");
    await ctx.db.patch(args.orderId, {
      adminNote: args.adminNote.trim() || undefined,
    });
    return null;
  },
});

// ─── ADMIN: Orders by user (for customer details dialog) ──────────────────────

export const getOrdersByUserId = query({
  args: { userId: v.id("users") },
  returns: v.array(v.object({
    _id: v.id("orders"),
    _creationTime: v.number(),
    status: orderStatusValidator,
    total: v.number(),
    paymentStatus: v.union(v.literal("unpaid"), v.literal("paid"), v.literal("refunded")),
  })),
  handler: async (ctx, args) => {
    await requirePermission(ctx, "orders");
    const orders = await ctx.db
      .query("orders")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(10);
    
    return orders.map((order) => ({
      _id: order._id,
      _creationTime: order._creationTime,
      status: order.status,
      total: order.total,
      paymentStatus: order.paymentStatus,
    }));
  },
});

// ─── PRIVATE HELPERS ─────────────────────────────────────────────────────────

async function recalcOrderTotals(ctx: MutationCtx, orderId: Id<"orders">) {
  const items = await ctx.db
    .query("orderItems")
    .withIndex("by_orderId", (q) => q.eq("orderId", orderId))
    .collect();
  const order = await ctx.db.get(orderId);
  if (!order) return;
  const subtotal = items.reduce((s, i) => s + i.totalPrice, 0);
  const total = subtotal + (order.deliveryCost ?? 0) - (order.discountAmount ?? 0);
  await ctx.db.patch(orderId, { subtotal, total });
}

// ─── ADMIN: Edit order snapshot ───────────────────────────────────────────────

export const updateOrderSnapshot = mutation({
  args: {
    orderId: v.id("orders"),
    name: v.string(),
    phone: v.string(),
    email: v.optional(v.string()),
    address: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requirePermission(ctx, "orders");
    const { orderId, name, phone, email, address } = args;
    const order = await ctx.db.get(orderId);
    if (!order) throw new ConvexError("Order not found");
    await ctx.db.patch(orderId, {
      shippingAddress: { name, phone, email, address },
    });
    return null;
  },
});

// ─── ADMIN: Edit order items ──────────────────────────────────────────────────

export const updateOrderItem = mutation({
  args: {
    orderId: v.id("orders"),
    itemId: v.id("orderItems"),
    variantId: v.id("productVariants"),
    quantity: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireOrderAction(ctx, "edit");
    const { orderId, itemId, variantId, quantity } = args;
    if (quantity < 1 || !Number.isInteger(quantity)) throw new ConvexError("Quantity must be a positive integer");

    const item = await ctx.db.get(itemId);
    if (!item || item.orderId !== orderId) throw new ConvexError("Item not found");

    // If variant changed, adjust stock
    if (item.variantId !== variantId) {
      const oldVariant = await ctx.db.get(item.variantId);
      const newVariant = await ctx.db.get(variantId);
      if (!newVariant) throw new ConvexError("Variant not found");
      if (newVariant.stock < quantity) throw new ConvexError("Insufficient stock");

      if (oldVariant) {
        await ctx.db.patch(item.variantId, { stock: oldVariant.stock + item.quantity });
      }
      await ctx.db.patch(variantId, { stock: newVariant.stock - quantity });

      // Update item with new variant info, keep original unit price
      await ctx.db.patch(itemId, {
        variantId,
        color: newVariant.color ?? item.color,
        size: newVariant.size ?? item.size,
        quantity,
        totalPrice: item.unitPrice * quantity,
      });
    } else {
      // Same variant, just update quantity
      const variant = await ctx.db.get(variantId);
      if (!variant) throw new ConvexError("Variant not found");
      const stockDiff = quantity - item.quantity;
      if (stockDiff > 0 && variant.stock < stockDiff) throw new ConvexError("Insufficient stock");
      await ctx.db.patch(variantId, { stock: variant.stock - stockDiff });
      await ctx.db.patch(itemId, { quantity, totalPrice: item.unitPrice * quantity });
    }

    await recalcOrderTotals(ctx, orderId);
    return null;
  },
});

export const removeOrderItem = mutation({
  args: {
    orderId: v.id("orders"),
    itemId: v.id("orderItems"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireOrderAction(ctx, "edit");
    const { orderId, itemId } = args;

    const item = await ctx.db.get(itemId);
    if (!item || item.orderId !== orderId) throw new ConvexError("Item not found");

    // Restore stock
    const variant = await ctx.db.get(item.variantId);
    if (variant) {
      await ctx.db.patch(item.variantId, { stock: variant.stock + item.quantity });
    }

    await ctx.db.delete(itemId);
    await recalcOrderTotals(ctx, orderId);
    return null;
  },
});

export const addOrderItem = mutation({
  args: {
    orderId: v.id("orders"),
    productId: v.id("products"),
    variantId: v.id("productVariants"),
    quantity: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireOrderAction(ctx, "edit");
    const { orderId, productId, variantId, quantity } = args;
    if (quantity < 1 || !Number.isInteger(quantity)) throw new ConvexError("Quantity must be a positive integer");

    const product = await ctx.db.get(productId);
    if (!product) throw new ConvexError("Product not found");

    const variant = await ctx.db.get(variantId);
    if (!variant) throw new ConvexError("Variant not found");
    if (variant.productId !== productId) throw new ConvexError("Variant does not belong to product");
    if (variant.stock < quantity) throw new ConvexError("Insufficient stock");

    const unitPrice = variant.priceOverride ?? product.basePrice;

    await ctx.db.patch(variantId, { stock: variant.stock - quantity });

    await ctx.db.insert("orderItems", {
      orderId,
      productId,
      variantId,
      productName: product.name,
      size: variant.size,
      color: variant.color,
      unitPrice,
      quantity,
      totalPrice: unitPrice * quantity,
    });

    await recalcOrderTotals(ctx, orderId);
    return null;
  },
});

// ─── ADMIN: Edit order pricing ────────────────────────────────────────────────

export const updateOrderPricing = mutation({
  args: {
    orderId: v.id("orders"),
    deliveryCost: v.number(),
    discountAmount: v.number(),
    paymentMethod: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireOrderAction(ctx, "edit");
    const { orderId, deliveryCost, discountAmount, paymentMethod } = args;

    const order = await ctx.db.get(orderId);
    if (!order) throw new ConvexError("Order not found");

    const total = order.subtotal + deliveryCost - discountAmount;
    if (total < 0) throw new ConvexError("Discount cannot exceed order total");
    await ctx.db.patch(orderId, {
      deliveryCost,
      discountAmount,
      total,
      ...(paymentMethod !== undefined ? { paymentMethod } : {}),
    });
    return null;
  },
});

// ─── ADMIN: Advance paid query ────────────────────────────────────────────────

export const getAdvancePaid = query({
  args: { orderId: v.id("orders") },
  returns: v.number(),
  handler: async (ctx, args) => {
    await requirePermission(ctx, "orders");
    const payments = await ctx.db
      .query("payments")
      .withIndex("by_orderId", (q) => q.eq("orderId", args.orderId))
      .filter((q) => q.eq(q.field("status"), "valid"))
      .collect();
    return payments.reduce((sum, p) => sum + p.amount, 0);
  },
});
