import { query, mutation } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { requireAuth } from "./lib/auth.helpers";
import { getProductDiscountedPrice } from "./lib/discounts";

const wishlistItemFull = v.object({
  _id: v.id("wishlistItems"),
  _creationTime: v.number(),
  userId: v.id("users"),
  productId: v.id("products"),
  productName: v.string(),
  productSlug: v.string(),
  basePrice: v.number(),
  discountedPrice: v.number(),
  imageUrl: v.union(v.string(), v.null()),
  isActive: v.boolean(),
  averageRating: v.number(),
  totalRatings: v.number(),
});

/** Reactive wishlist with enriched product info */
export const get = query({
  args: {},
  returns: v.array(wishlistItemFull),
  handler: async (ctx) => {
    const user = await requireAuth(ctx);

    const items = await ctx.db
      .query("wishlistItems")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .take(200);

    const enriched = await Promise.all(
      items.map(async (item) => {
        const product = await ctx.db.get(item.productId);
        if (!product) return null;

        const { discountedPrice } = await getProductDiscountedPrice(ctx, product);
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
          imageUrl,
          isActive: product.isActive,
          averageRating: product.averageRating,
          totalRatings: product.totalRatings,
        };
      })
    );

    return enriched.filter(Boolean) as NonNullable<(typeof enriched)[0]>[];
  },
});

/** Check if a product is in the user's wishlist */
export const check = query({
  args: { productId: v.id("products") },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const item = await ctx.db
      .query("wishlistItems")
      .withIndex("by_userId_and_productId", (q) =>
        q.eq("userId", user._id).eq("productId", args.productId)
      )
      .unique();
    return !!item;
  },
});

/** Add or remove product from wishlist */
export const toggle = mutation({
  args: { productId: v.id("products") },
  returns: v.object({ inWishlist: v.boolean() }),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    const existing = await ctx.db
      .query("wishlistItems")
      .withIndex("by_userId_and_productId", (q) =>
        q.eq("userId", user._id).eq("productId", args.productId)
      )
      .unique();

    if (existing) {
      await ctx.db.delete(existing._id);
      return { inWishlist: false };
    } else {
      const product = await ctx.db.get(args.productId);
      if (!product) throw new ConvexError("Product not found");
      await ctx.db.insert("wishlistItems", {
        userId: user._id,
        productId: args.productId,
      });
      return { inWishlist: true };
    }
  },
});
