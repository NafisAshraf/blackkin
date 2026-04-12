import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { requireSuperAdmin } from "./lib/auth.helpers";

const permissionsValidator = v.object({
  orders: v.boolean(),
  marketing: v.boolean(),
  products: v.boolean(),
  settings: v.boolean(),
  pages: v.boolean(),
  users: v.boolean(),
});

/** List all admin and superadmin users */
export const listEmployees = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("users"),
      _creationTime: v.number(),
      name: v.optional(v.string()),
      email: v.optional(v.string()),
      phone: v.optional(v.string()),
      role: v.union(v.literal("admin"), v.literal("superadmin")),
      isActive: v.optional(v.boolean()),
      permissions: v.optional(permissionsValidator),
    })
  ),
  handler: async (ctx) => {
    await requireSuperAdmin(ctx);
    const admins = await ctx.db
      .query("users")
      .withIndex("by_role", (q) => q.eq("role", "admin"))
      .take(200);
    const superadmins = await ctx.db
      .query("users")
      .withIndex("by_role", (q) => q.eq("role", "superadmin"))
      .take(10);
    return [...superadmins, ...admins].map((u) => ({
      _id: u._id,
      _creationTime: u._creationTime,
      name: u.name,
      email: u.email,
      phone: u.phone,
      role: u.role as "admin" | "superadmin",
      isActive: u.isActive,
      permissions: u.permissions,
    }));
  },
});

/** Update an employee's permissions */
export const updatePermissions = mutation({
  args: {
    userId: v.id("users"),
    permissions: permissionsValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);
    const user = await ctx.db.get(args.userId);
    if (!user || user.role === "customer") throw new Error("Employee not found");
    await ctx.db.patch(args.userId, { permissions: args.permissions });
    return null;
  },
});

/** Deactivate an employee */
export const deactivateEmployee = mutation({
  args: { userId: v.id("users") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);
    const user = await ctx.db.get(args.userId);
    if (!user || user.role === "customer") throw new Error("Employee not found");
    await ctx.db.patch(args.userId, { isActive: false });
    return null;
  },
});

/** Reactivate an employee */
export const reactivateEmployee = mutation({
  args: { userId: v.id("users") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);
    const user = await ctx.db.get(args.userId);
    if (!user || user.role === "customer") throw new Error("Employee not found");
    await ctx.db.patch(args.userId, { isActive: undefined });
    return null;
  },
});

/** Internal: promote a user to admin after Better Auth creates them */
export const promoteUserByEmail = internalMutation({
  args: {
    email: v.string(),
    permissions: permissionsValidator,
  },
  returns: v.union(v.id("users"), v.null()),
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .unique();
    if (!user) return null;
    await ctx.db.patch(user._id, { role: "admin", permissions: args.permissions });
    return user._id;
  },
});
