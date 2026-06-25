import { action } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

const permissionsValidator = v.object({
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
  blog: v.boolean(),
});

function isPhoneNumber(value: string): boolean {
  const cleaned = value.replace(/[\s\-()]/g, "");
  return /^\+?\d{10,15}$/.test(cleaned);
}

function normalizePhone(value: string): string {
  const cleaned = value.replace(/[\s\-()]/g, "");
  if (cleaned.startsWith("+")) return cleaned;
  if (cleaned.startsWith("88")) return `+${cleaned}`;
  return `+88${cleaned}`;
}

export const createEmployee = action({
  args: {
    name: v.string(),
    phone: v.string(),
    permissions: permissionsValidator,
  },
  returns: v.object({ success: v.boolean(), error: v.optional(v.string()) }),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return { success: false, error: "Unauthenticated" };

    const caller = await ctx.runQuery(internal.users.getByAuthUserIdInternal, {
      authUserId: identity.subject,
    });

    if (!caller || caller.isActive === false || caller.role !== "superadmin") {
      return { success: false, error: "Unauthorized" };
    }

    const name = args.name.trim();
    if (!name) {
      return { success: false, error: "Name is required" };
    }

    if (!isPhoneNumber(args.phone)) {
      return {
        success: false,
        error: "Please enter a valid mobile number (10-15 digits).",
      };
    }

    try {
      await ctx.runMutation(internal.employees.upsertEmployeeByPhone, {
        name,
        phone: normalizePhone(args.phone),
        permissions: args.permissions,
      });
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err.message : "Failed to create employee",
      };
    }

    return { success: true };
  },
});
