import { ConvexError } from "convex/values";
import { Doc } from "../_generated/dataModel";
import { MutationCtx, QueryCtx } from "../_generated/server";

type UserPermissions = {
  orders:
    | {
        enabled: boolean;
        allowedStatuses: string[];
        canEdit: boolean;
        canDelete: boolean;
        canConfirm: boolean;
      }
    | undefined;
  marketing: boolean;
  products: boolean;
  settings: boolean;
  pages: boolean;
  users: boolean;
  vouchers: boolean;
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
    .withIndex("by_authUserId", (q) => q.eq("authUserId", identity.subject))
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
  permission: keyof UserPermissions,
) {
  const user = await requireAuth(ctx);
  if (user.role === "superadmin") {
    return user;
  }
  if (user.role === "customer") {
    throw new ConvexError("Unauthorized");
  }
  // role is "admin"
  if (permission === "orders") {
    const op = user.permissions?.orders;
    if (!op || !op.enabled) throw new ConvexError("Unauthorized");
  } else {
    if (
      !user.permissions ||
      user.permissions[
        permission as Exclude<keyof UserPermissions, "orders">
      ] === false
    ) {
      throw new ConvexError("Unauthorized");
    }
  }
  return user;
}

/**
 * Checks that the current user can perform a specific order action (edit/delete/confirm).
 * Superadmins always pass. Admins must have the orders permission enabled AND
 * the specific action flag set.
 * Throws ConvexError("Unauthorized") if not permitted.
 */
export async function requireOrderAction(
  ctx: QueryCtx | MutationCtx,
  action: "edit" | "delete" | "confirm",
): Promise<Doc<"users">> {
  const user = await requirePermission(ctx, "orders");
  if (user.role === "superadmin") return user;
  const op = user.permissions!.orders!;
  const flagMap = {
    edit: op.canEdit,
    delete: op.canDelete,
    confirm: op.canConfirm,
  } as const;
  const allowed = flagMap[action];
  if (!allowed) throw new ConvexError("Unauthorized");
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
    .withIndex("by_authUserId", (q) => q.eq("authUserId", identity.subject))
    .unique();

  if (!user || user.isActive === false) return null;
  return user;
}
