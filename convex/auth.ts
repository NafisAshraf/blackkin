import { createClient, type GenericCtx } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { components, internal } from "./_generated/api";
import { DataModel } from "./_generated/dataModel";
import { query } from "./_generated/server";
import { betterAuth } from "better-auth/minimal";
import authConfig from "./auth.config";
import type { AuthFunctions } from "@convex-dev/better-auth";
const siteUrl = process.env.SITE_URL!;

function isSyntheticPhoneEmail(email: string | undefined | null): boolean {
  return !!email?.endsWith("@phone.blackkin.local");
}

function syntheticEmailToPhone(email: string): string {
  return `+${email.replace("@phone.blackkin.local", "")}`;
}

const authFunctions: AuthFunctions = internal.auth;

// The component client has methods needed for integrating Convex with Better Auth,
// as well as helper methods for general use.
export const authComponent = createClient<DataModel>(components.betterAuth, {
  authFunctions,
  triggers: {
    user: {
      onCreate: async (ctx, doc) => {
        const isPhone = isSyntheticPhoneEmail(doc.email);
        await ctx.db.insert("users", {
          authUserId: doc._id,
          email: isPhone ? undefined : doc.email,
          phone: isPhone ? syntheticEmailToPhone(doc.email) : undefined,
          name: isPhone ? undefined : doc.name,
          role: "customer",
        });
      },
      onUpdate: async (ctx, newDoc) => {
        const user = await ctx.db
          .query("users")
          .withIndex("by_authUserId", (q) => q.eq("authUserId", newDoc._id))
          .unique();
        if (user) {
          const isPhone = isSyntheticPhoneEmail(newDoc.email);
          // Always sync name from Better Auth (so session.user.name stays consistent).
          // For email: only overwrite when Better Auth itself holds a real email.
          // For phone users the Better Auth email is synthetic, so we don't touch the
          // real email that the user may have added directly via the Convex updateProfile
          // mutation. Similarly, we preserve the Convex phone field for email users.
          await ctx.db.patch(user._id, {
            name: newDoc.name ?? user.name,
            ...(isPhone
              ? { phone: syntheticEmailToPhone(newDoc.email) }   // keep user.email intact
              : { email: newDoc.email }),                         // keep user.phone intact
          });
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
    // Configure simple, non-verified email/password to get started
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
    },
    socialProviders: {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      },
    },
    plugins: [
      // The Convex plugin is required for Convex compatibility
      convex({ authConfig }),
    ],
  })
}

// Example function for getting the current user
export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    return authComponent.getAuthUser(ctx);
  },
});
