import { query, mutation } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { requireAuth, requireAdmin } from "./lib/auth.helpers";

const reviewObject = v.object({
  _id: v.id("reviews"),
  _creationTime: v.number(),
  productId: v.id("products"),
  userId: v.id("users"),
  orderId: v.id("orders"),
  rating: v.number(),
  comment: v.optional(v.string()),
  isApproved: v.boolean(),
  reviewerName: v.optional(v.string()),
});

/** Public: approved reviews for a product */
export const listByProduct = query({
  args: {
    productId: v.id("products"),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const result = await ctx.db
      .query("reviews")
      .withIndex("by_productId_and_isApproved", (q) =>
        q.eq("productId", args.productId).eq("isApproved", true)
      )
      .order("desc")
      .paginate(args.paginationOpts);

    const page = await Promise.all(
      result.page.map(async (review) => {
        const user = await ctx.db.get(review.userId);
        return {
          ...review,
          reviewerName: user?.name ?? user?.email?.split("@")[0],
        };
      })
    );

    return { ...result, page };
  },
});

/** Admin: pending reviews */
export const listPending = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const result = await ctx.db
      .query("reviews")
      .filter((q) => q.eq(q.field("isApproved"), false))
      .order("desc")
      .paginate(args.paginationOpts);

    const page = await Promise.all(
      result.page.map(async (review) => {
        const user = await ctx.db.get(review.userId);
        return { ...review, reviewerName: user?.name ?? user?.email?.split("@")[0] };
      })
    );

    return { ...result, page };
  },
});

/**
 * Create a review.
 * Validates the user has a delivered order containing this product.
 * One review per product per user.
 */
export const create = mutation({
  args: {
    productId: v.id("products"),
    orderId: v.id("orders"),
    rating: v.number(),
    comment: v.optional(v.string()),
  },
  returns: v.id("reviews"),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    if (args.rating < 1 || args.rating > 5) {
      throw new ConvexError("Rating must be between 1 and 5");
    }

    // Verify the order belongs to this user and is delivered
    const order = await ctx.db.get(args.orderId);
    if (!order || order.userId !== user._id) {
      throw new ConvexError("Order not found");
    }
    if (order.status !== "completed") {
      throw new ConvexError("You can only review products from completed orders");
    }

    // Verify the order contains this product
    const orderItem = await ctx.db
      .query("orderItems")
      .withIndex("by_orderId", (q) => q.eq("orderId", args.orderId))
      .take(50);
    const hasProduct = orderItem.some((i) => i.productId === args.productId);
    if (!hasProduct) {
      throw new ConvexError("This order does not contain that product");
    }

    // One review per product per user
    const existing = await ctx.db
      .query("reviews")
      .withIndex("by_userId_and_productId", (q) =>
        q.eq("userId", user._id).eq("productId", args.productId)
      )
      .unique();
    if (existing) throw new ConvexError("You have already reviewed this product");

    return await ctx.db.insert("reviews", {
      productId: args.productId,
      userId: user._id,
      orderId: args.orderId,
      rating: args.rating,
      comment: args.comment,
      isApproved: false, // requires admin approval
    });
  },
});

/** Admin: all approved reviews (for moderation) */
export const listApproved = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const result = await ctx.db
      .query("reviews")
      .filter((q) => q.eq(q.field("isApproved"), true))
      .order("desc")
      .paginate(args.paginationOpts);

    const page = await Promise.all(
      result.page.map(async (review) => {
        const user = await ctx.db.get(review.userId);
        return { ...review, reviewerName: user?.name ?? user?.email?.split("@")[0] };
      })
    );

    return { ...result, page };
  },
});

/** Admin: approve a review and update product's denormalized rating */
export const approve = mutation({
  args: { reviewId: v.id("reviews") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const review = await ctx.db.get(args.reviewId);
    if (!review) throw new ConvexError("Review not found");
    if (review.isApproved) return null; // already approved

    await ctx.db.patch(args.reviewId, { isApproved: true });

    // Recalculate product's denormalized rating
    const allApproved = await ctx.db
      .query("reviews")
      .withIndex("by_productId_and_isApproved", (q) =>
        q.eq("productId", review.productId).eq("isApproved", true)
      )
      .take(1000);

    const totalRatings = allApproved.length + 1; // +1 for the one just approved
    const sumRatings =
      allApproved.reduce((sum, r) => sum + r.rating, 0) + review.rating;
    const averageRating = Math.round((sumRatings / totalRatings) * 10) / 10;

    await ctx.db.patch(review.productId, { totalRatings, averageRating });
    return null;
  },
});

/** Admin: reject/unapprove a review */
export const reject = mutation({
  args: { reviewId: v.id("reviews") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const review = await ctx.db.get(args.reviewId);
    if (!review) throw new ConvexError("Review not found");

    const wasApproved = review.isApproved;
    await ctx.db.patch(args.reviewId, { isApproved: false });

    if (wasApproved) {
      // Recalculate product rating
      const remaining = await ctx.db
        .query("reviews")
        .withIndex("by_productId_and_isApproved", (q) =>
          q.eq("productId", review.productId).eq("isApproved", true)
        )
        .take(1000);
      const totalRatings = remaining.length;
      const averageRating =
        totalRatings > 0
          ? Math.round(
              (remaining.reduce((s, r) => s + r.rating, 0) / totalRatings) * 10
            ) / 10
          : 0;
      await ctx.db.patch(review.productId, { totalRatings, averageRating });
    }

    return null;
  },
});
