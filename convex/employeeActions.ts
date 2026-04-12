import { action } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

const permissionsValidator = v.object({
  orders: v.boolean(),
  marketing: v.boolean(),
  products: v.boolean(),
  settings: v.boolean(),
  pages: v.boolean(),
  users: v.boolean(),
});

const SITE_URL = process.env.SITE_URL!;
const CONVEX_SITE_URL = process.env.CONVEX_SITE_URL!;

export const createEmployee = action({
  args: {
    name: v.string(),
    email: v.string(),
    password: v.string(),
    permissions: permissionsValidator,
  },
  returns: v.object({ success: v.boolean(), error: v.optional(v.string()) }),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return { success: false, error: "Unauthenticated" };

    // Call Better Auth sign-up endpoint over Convex HTTP router
    const signUpUrl = `${CONVEX_SITE_URL}/api/auth/sign-up/email`;
    let authRes: Response;
    try {
      authRes = await fetch(signUpUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Origin": SITE_URL,
          "Accept": "application/json",
        },
        body: JSON.stringify({
          email: args.email,
          password: args.password,
          name: args.name,
        }),
      });
    } catch {
      return { success: false, error: "Network error creating account" };
    }

    if (!authRes.ok) {
      let errMsg = "Failed to create account";
      try {
        const body = (await authRes.json()) as { message?: string };
        errMsg = body.message ?? errMsg;
      } catch {
        // ignore json parse error
      }
      return { success: false, error: errMsg };
    }

    // The Better Auth onCreate trigger created the Convex user as "customer".
    // Promote them to admin.
    const userId = await ctx.runMutation(internal.employees.promoteUserByEmail, {
      email: args.email,
      permissions: args.permissions,
    });

    if (!userId) {
      return {
        success: false,
        error: "Account created but role assignment failed. Check Convex logs.",
      };
    }

    return { success: true };
  },
});
