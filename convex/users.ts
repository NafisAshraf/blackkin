import { query, mutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { authComponent } from "./auth";
import { requireAdmin } from "./lib/auth.helpers";
import { mutation as triggerMutation } from "./triggers";

const userObject = v.object({
  _id: v.id("users"),
  _creationTime: v.number(),
  authUserId: v.string(),
  name: v.optional(v.string()),
  email: v.string(),
  role: v.union(v.literal("customer"), v.literal("admin")),
  isActive: v.optional(v.boolean()),
});

export const getCurrentUserWithRole = query({
  args: {},
  returns: v.union(userObject, v.null()),
  handler: async (ctx) => {
    // getAuthUser throws ConvexError("Unauthenticated") during sign-out: the Convex
    // JWT is still technically present but the better-auth session is already
    // invalidated server-side. Catch it and return null gracefully.
    let authUser;
    try {
      authUser = await authComponent.getAuthUser(ctx);
    } catch {
      return null;
    }
    if (!authUser) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_authUserId", (q) => q.eq("authUserId", authUser._id))
      .unique();

    return user ?? null;
  },
});

/** Admin: paginated customer list */
export const listCustomers = query({
  args: {
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    return await ctx.db
      .query("users")
      .withIndex("by_role", (q) => q.eq("role", "customer"))
      .order("desc")
      .paginate(args.paginationOpts);
  },
});

/** Admin: customer detail with order summary */
export const getCustomerDetail = query({
  args: { userId: v.id("users") },
  returns: v.union(
    v.object({
      user: userObject,
      recentOrders: v.array(
        v.object({
          _id: v.id("orders"),
          _creationTime: v.number(),
          status: v.union(
            v.literal("pending"),
            v.literal("processed"),
            v.literal("shipped"),
            v.literal("delivered"),
            v.literal("cancelled")
          ),
          total: v.number(),
          paymentStatus: v.union(
            v.literal("unpaid"),
            v.literal("paid"),
            v.literal("refunded")
          ),
        })
      ),
      wishlistCount: v.number(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const user = await ctx.db.get(args.userId);
    if (!user) return null;

    const recentOrders = await ctx.db
      .query("orders")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(10);

    const wishlistItems = await ctx.db
      .query("wishlistItems")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .take(500);

    return {
      user,
      recentOrders: recentOrders.map((o) => ({
        _id: o._id,
        _creationTime: o._creationTime,
        status: o.status,
        total: o.total,
        paymentStatus: o.paymentStatus,
      })),
      wishlistCount: wishlistItems.length,
    };
  },
});

/** Admin: activate or deactivate a customer account */
export const toggleActive = triggerMutation({
  args: {
    userId: v.id("users"),
    isActive: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const user = await ctx.db.get(args.userId);
    if (!user) return null;
    if (user.role === "admin") return null; // cannot deactivate admins
    await ctx.db.patch(args.userId, { isActive: args.isActive });
    return null;
  },
});

/** Used by payment action to resolve a user from their JWT identity subject */
export const getByAuthUserIdInternal = internalQuery({
  args: { authUserId: v.string() },
  handler: async (ctx, { authUserId }) => {
    return await ctx.db
      .query("users")
      .withIndex("by_authUserId", (q) => q.eq("authUserId", authUserId))
      .unique();
  },
});
