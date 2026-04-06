import { query, mutation } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { requireAuth } from "./lib/auth.helpers";
import { getProductDiscountedPrice } from "./lib/discounts";
import { Id } from "./_generated/dataModel";

const cartItemFull = v.object({
  _id: v.id("cartItems"),
  _creationTime: v.number(),
  userId: v.id("users"),
  productId: v.id("products"),
  variantId: v.id("productVariants"),
  quantity: v.number(),
  // enriched product info
  productName: v.string(),
  productSlug: v.string(),
  basePrice: v.number(),
  discountedPrice: v.number(),
  discountAmount: v.number(),
  size: v.string(),
  color: v.optional(v.string()),
  imageUrl: v.union(v.string(), v.null()),
  stock: v.number(),
});

/** Reactive cart query - returns enriched cart with current prices */
export const get = query({
  args: {},
  returns: v.array(cartItemFull),
  handler: async (ctx) => {
    const user = await requireAuth(ctx);

    const items = await ctx.db
      .query("cartItems")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .take(100);

    const enriched = await Promise.all(
      items.map(async (item) => {
        const product = await ctx.db.get(item.productId);
        const variant = await ctx.db.get(item.variantId);

        if (!product || !variant) return null;

        const { discountedPrice, discountAmount } =
          await getProductDiscountedPrice(ctx, product);

        const firstImage = product.media.find((m) => m.type === "image");
        const imageUrl = firstImage
          ? await ctx.storage.getUrl(firstImage.storageId)
          : null;

        return {
          ...item,
          productName: product.name,
          productSlug: product.slug,
          basePrice: product.basePrice,
          discountedPrice,
          discountAmount,
          size: variant.size,
          color: variant.color,
          imageUrl,
          stock: variant.stock,
        };
      })
    );

    return enriched.filter(Boolean) as typeof enriched extends (infer T | null)[] ? Exclude<T, null>[] : never;
  },
});

export const add = mutation({
  args: {
    productId: v.id("products"),
    variantId: v.id("productVariants"),
    quantity: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    if (args.quantity < 1) throw new ConvexError("Quantity must be at least 1");

    const product = await ctx.db.get(args.productId);
    if (!product || !product.isActive) throw new ConvexError("Product not available");

    const variant = await ctx.db.get(args.variantId);
    if (!variant || variant.productId !== args.productId) {
      throw new ConvexError("Variant not found");
    }
    if (variant.stock < args.quantity) throw new ConvexError("Insufficient stock");

    // If already in cart, increment
    const existing = await ctx.db
      .query("cartItems")
      .withIndex("by_userId_and_variantId", (q) =>
        q.eq("userId", user._id).eq("variantId", args.variantId)
      )
      .unique();

    if (existing) {
      const newQty = existing.quantity + args.quantity;
      if (variant.stock < newQty) throw new ConvexError("Insufficient stock");
      await ctx.db.patch(existing._id, { quantity: newQty });
    } else {
      await ctx.db.insert("cartItems", {
        userId: user._id,
        productId: args.productId,
        variantId: args.variantId,
        quantity: args.quantity,
      });
    }
    return null;
  },
});

export const updateQuantity = mutation({
  args: {
    cartItemId: v.id("cartItems"),
    quantity: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    if (args.quantity < 1) throw new ConvexError("Quantity must be at least 1");

    const item = await ctx.db.get(args.cartItemId);
    if (!item || item.userId !== user._id) throw new ConvexError("Cart item not found");

    const variant = await ctx.db.get(item.variantId);
    if (!variant || variant.stock < args.quantity) {
      throw new ConvexError("Insufficient stock");
    }

    await ctx.db.patch(args.cartItemId, { quantity: args.quantity });
    return null;
  },
});

export const remove = mutation({
  args: { cartItemId: v.id("cartItems") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const item = await ctx.db.get(args.cartItemId);
    if (!item || item.userId !== user._id) throw new ConvexError("Cart item not found");
    await ctx.db.delete(args.cartItemId);
    return null;
  },
});

export const clear = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const user = await requireAuth(ctx);
    let done = false;
    while (!done) {
      const items = await ctx.db
        .query("cartItems")
        .withIndex("by_userId", (q) => q.eq("userId", user._id))
        .take(64);
      if (items.length === 0) {
        done = true;
      } else {
        await Promise.all(items.map((i) => ctx.db.delete(i._id)));
      }
    }
    return null;
  },
});

/**
 * Merge guest cart (from localStorage) into the logged-in user's cart.
 * Called on login. Drops invalid items silently.
 */
export const mergeGuestCart = mutation({
  args: {
    items: v.array(
      v.object({
        productId: v.string(),
        variantId: v.string(),
        quantity: v.number(),
      })
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    for (const guestItem of args.items) {
      // Validate IDs are valid Convex IDs by attempting to fetch
      let product, variant;
      try {
        product = await ctx.db.get(guestItem.productId as Id<"products">);
        variant = await ctx.db.get(guestItem.variantId as Id<"productVariants">);
      } catch {
        continue; // Invalid ID format - skip
      }

      if (!product || !product.isActive) continue;
      if (!variant || variant.productId !== product._id) continue;

      const qty = Math.max(1, Math.min(guestItem.quantity, variant.stock));
      if (qty === 0) continue;

      const existing = await ctx.db
        .query("cartItems")
        .withIndex("by_userId_and_variantId", (q) =>
          q.eq("userId", user._id).eq("variantId", variant!._id)
        )
        .unique();

      if (existing) {
        const newQty = Math.min(existing.quantity + qty, variant.stock);
        await ctx.db.patch(existing._id, { quantity: newQty });
      } else {
        await ctx.db.insert("cartItems", {
          userId: user._id,
          productId: product._id,
          variantId: variant._id,
          quantity: qty,
        });
      }
    }
    return null;
  },
});

/** Server-calculated cart pricing - used during checkout display */
export const getCartWithPricing = query({
  args: {},
  returns: v.object({
    items: v.array(cartItemFull),
    subtotal: v.number(),
    discountAmount: v.number(),
    total: v.number(),
  }),
  handler: async (ctx) => {
    const user = await requireAuth(ctx);

    const cartItems = await ctx.db
      .query("cartItems")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .take(100);

    let subtotal = 0;
    let discountAmount = 0;

    const enriched = await Promise.all(
      cartItems.map(async (item) => {
        const product = await ctx.db.get(item.productId);
        const variant = await ctx.db.get(item.variantId);
        if (!product || !variant) return null;

        const pricing = await getProductDiscountedPrice(ctx, product);
        const itemSubtotal = product.basePrice * item.quantity;
        const itemDiscount = pricing.discountAmount * item.quantity;
        subtotal += itemSubtotal;
        discountAmount += itemDiscount;

        const firstImage = product.media.find((m) => m.type === "image");
        const imageUrl = firstImage
          ? await ctx.storage.getUrl(firstImage.storageId)
          : null;

        return {
          ...item,
          productName: product.name,
          productSlug: product.slug,
          basePrice: product.basePrice,
          discountedPrice: pricing.discountedPrice,
          discountAmount: pricing.discountAmount,
          size: variant.size,
          color: variant.color,
          imageUrl,
          stock: variant.stock,
        };
      })
    );

    const validItems = enriched.filter(Boolean) as NonNullable<typeof enriched[0]>[];

    return {
      items: validItems,
      subtotal,
      discountAmount,
      total: subtotal - discountAmount,
    };
  },
});
