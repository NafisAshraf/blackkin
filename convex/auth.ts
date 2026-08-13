import { createClient, type GenericCtx } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { components, internal } from "./_generated/api";
import { DataModel } from "./_generated/dataModel";
import { query } from "./_generated/server";
import { betterAuth } from "better-auth/minimal";
import { phoneNumber } from "better-auth/plugins";
import authConfig from "./auth.config";
import type { AuthFunctions } from "@convex-dev/better-auth";

const siteUrl = process.env.SITE_URL!;

const authFunctions: AuthFunctions = internal.auth;

// The component client has methods needed for integrating Convex with Better Auth,
// as well as helper methods for general use.
export const authComponent = createClient<DataModel>(components.betterAuth, {
  authFunctions,
  triggers: {
    user: {
      onCreate: async (ctx, doc) => {
        // The phoneNumber plugin stores the phone on the Better Auth user object.
        const phone: string | undefined =
          (doc as { phoneNumber?: string }).phoneNumber || undefined;

        if (phone) {
          // Smart backfill: if a Convex user with this phone already exists
          // (e.g. from a previous auth migration), re-point their authUserId
          // instead of creating a duplicate record.
          const existing = await ctx.db
            .query("users")
            .withIndex("by_phone", (q) => q.eq("phone", phone))
            .unique();
          if (existing) {
            await ctx.db.patch(existing._id, { authUserId: doc._id });
            return;
          }
        }

        await ctx.db.insert("users", {
          authUserId: doc._id,
          phone,
          // name is collected later (at checkout or account settings)
          role: "customer",
        });
      },
      onUpdate: async (ctx, newDoc) => {
        const user = await ctx.db
          .query("users")
          .withIndex("by_authUserId", (q) => q.eq("authUserId", newDoc._id))
          .unique();
        if (!user) return;

        const phone: string | undefined =
          (newDoc as { phoneNumber?: string }).phoneNumber || undefined;
        const name: string | undefined = newDoc.name || undefined;

        // Only patch fields that have a value to avoid overwriting Convex-side data.
        const patch: Record<string, unknown> = {};
        if (phone) patch.phone = phone;
        if (name) patch.name = name;
        if (Object.keys(patch).length > 0) {
          await ctx.db.patch(user._id, patch);
        }
      },
      onDelete: async (ctx, doc) => {
        const user = await ctx.db
          .query("users")
          .withIndex("by_authUserId", (q) => q.eq("authUserId", doc._id))
          .unique();
        if (user) {
          await ctx.db.delete(user._id);
        }
      },
    },
  },
});

export const { onCreate, onUpdate, onDelete } = authComponent.triggersApi();

export const createAuth = (ctx: GenericCtx<DataModel>) => {
  return betterAuth({
    baseURL: siteUrl,
    trustedOrigins: ["http://192.168.100.14:3000"],
    database: authComponent.adapter(ctx),
    session: {
      // Sessions last 30 days — users stay signed in on their device.
      expiresIn: 60 * 60 * 24 * 30,
      // Only refresh (re-write) the session token if it is older than 7 days.
      // Default is ~1 day, which causes frequent adapter writes.
      updateAge: 60 * 60 * 24 * 7,
      // Cookie cache embeds a short-lived session snapshot in the cookie so
      // /get-session requests don't need to hit the Convex DB every time.
      disableCookieCache: false,
    },
    plugins: [
      // The Convex plugin is required for Convex compatibility
      convex({ authConfig }),
      // Phone-only authentication is intentionally enabled at the client's
      // request. Keep the phone plugin so existing Better Auth users, sessions,
      // and Convex employee-account linking continue to work unchanged.
      phoneNumber({
        // Auto-create a new user when the phone is submitted for the first time.
        // Without this, Better Auth throws 500 for new users (user not found).
        signUpOnVerification: {
          getTempEmail: (phone) =>
            `phone_${phone.replace(/[^0-9]/g, "")}@blackkin.internal`,
          getTempName: (phone) => phone,
        },
        // Intentionally do not send an SMS while phone-only login is active.
        sendOTP: async () => {},
        // This bypass is the requested security tradeoff: possession of the
        // phone number is enough to authenticate. The client still uses Better
        // Auth's verify route so normal user/session hooks keep firing.
        verifyOTP: async () => true,
      }),
    ],
  });
};

// Query helper for getting the current Better Auth user
export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    return authComponent.getAuthUser(ctx);
  },
});
