import { ConvexError } from "convex/values";
import { MutationCtx, QueryCtx } from "../_generated/server";

type UserPermissions = {
  orders: boolean;
  marketing: boolean;
  products: boolean;
  settings: boolean;
  pages: boolean;
  users: boolean;
};

/**
 * Derives the current user's doc from the Convex JWT identity.
 * Throws ConvexError("Unauthenticated") if not logged in.
 * NEVER accepts userId as argument — always server-derived.
 */
export async function requireAuth(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new ConvexError("Unauthenticated");
  }

  const user = await ctx.db
    .query("users")
    .withIndex("by_authUserId", (q) =>
      q.eq("authUserId", identity.subject)
    )
    .unique();

  if (!user) {
    throw new ConvexError("User not found");
  }

  if (user.isActive === false) {
    throw new ConvexError("Account deactivated");
  }

  return user;
}

/**
 * Derives the current user and checks for admin or superadmin role.
 * Throws ConvexError("Unauthorized") if not admin or superadmin.
 */
export async function requireAdmin(ctx: QueryCtx | MutationCtx) {
  const user = await requireAuth(ctx);
  if (user.role !== "admin" && user.role !== "superadmin") {
    throw new ConvexError("Unauthorized");
  }
  return user;
}

/**
 * Derives the current user and checks for superadmin role.
 * Throws ConvexError("Unauthorized") unless role is "superadmin".
 */
export async function requireSuperAdmin(ctx: QueryCtx | MutationCtx) {
  const user = await requireAuth(ctx);
  if (user.role !== "superadmin") {
    throw new ConvexError("Unauthorized");
  }
  return user;
}

/**
 * Checks a specific permission for the current user.
 * Superadmins always pass. Admins are checked against their permissions object.
 * Throws ConvexError("Unauthorized") if the user is a customer, or if the
 * admin lacks the required permission.
 */
export async function requirePermission(
  ctx: QueryCtx | MutationCtx,
  permission: keyof UserPermissions
) {
  const user = await requireAuth(ctx);
  if (user.role === "superadmin") {
    return user;
  }
  if (user.role === "customer") {
    throw new ConvexError("Unauthorized");
  }
  // role is "admin"
  if (!user.permissions || user.permissions[permission] === false) {
    throw new ConvexError("Unauthorized");
  }
  return user;
}

/**
 * Returns the current user doc or null if not authenticated.
 */
export async function optionalAuth(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;

  const user = await ctx.db
    .query("users")
    .withIndex("by_authUserId", (q) =>
      q.eq("authUserId", identity.subject)
    )
    .unique();

  if (!user || user.isActive === false) return null;
  return user;
}
