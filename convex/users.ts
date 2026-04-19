import { query, mutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { authComponent } from "./auth";
import {
  requireAdmin,
  requireAuth,
  requirePermission,
} from "./lib/auth.helpers";
import { mutation as triggerMutation } from "./triggers";

const userObject = v.object({
  _id: v.id("users"),
  _creationTime: v.number(),
  authUserId: v.string(),
  name: v.optional(v.string()),
  email: v.optional(v.string()),
  phone: v.optional(v.string()),
  role: v.union(
    v.literal("customer"),
    v.literal("admin"),
    v.literal("superadmin"),
  ),
  isActive: v.optional(v.boolean()),
  permissions: v.optional(
    v.object({
      orders: v.optional(
        v.object({
          enabled: v.boolean(),
          allowedStatuses: v.array(v.string()),
          canEdit: v.boolean(),
          canDelete: v.boolean(),
          canConfirm: v.boolean(),
        }),
      ),
      marketing: v.boolean(),
      products: v.boolean(),
      settings: v.boolean(),
      pages: v.boolean(),
      users: v.boolean(),
      vouchers: v.boolean(),
    }),
  ),
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
    await requirePermission(ctx, "users");
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
          orderNumber: v.number(),
          status: v.union(
            v.literal("new"),
            v.literal("confirmed"),
            v.literal("ready_for_delivery"),
            v.literal("in_courier"),
            v.literal("cancelled"),
            v.literal("hold"),
            v.literal("ship_later"),
            v.literal("paid"),
            v.literal("deleted"),
            v.literal("completed"),
          ),
          total: v.number(),
          paymentStatus: v.union(
            v.literal("unpaid"),
            v.literal("paid"),
            v.literal("refunded"),
          ),
        }),
      ),
      wishlistCount: v.number(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    await requirePermission(ctx, "users");

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
        orderNumber: o.orderNumber,
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
    if (user.role === "admin" || user.role === "superadmin") return null; // cannot deactivate admins
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

/**
 * Update the current user's Convex profile fields.
 *
 * - `name`  → also kept in sync by the Better Auth onUpdate trigger, but
 *             we patch here immediately so the UI reflects changes before
 *             the session token refreshes.
 * - `phone` → stored only in Convex (not in Better Auth's internal tables).
 * - `email` → for phone-auth users: stores a real contact email in Convex
 *             without altering the synthetic Better Auth email used for sign-in.
 *
 * Pass `""` to clear an optional field.
 */
export const updateProfile = mutation({
  args: {
    name: v.optional(v.string()),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    type UserPatch = { name?: string; phone?: string; email?: string };
    const patch: UserPatch = {};
    if (args.name !== undefined) {
      patch.name = args.name.trim() || undefined;
    }
    if (args.phone !== undefined) {
      patch.phone = args.phone.trim() || undefined;
    }
    if (args.email !== undefined) {
      patch.email = args.email.trim() || undefined;
    }
    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(user._id, patch);
    }
    return null;
  },
});
