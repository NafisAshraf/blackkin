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
      // Phone number OTP authentication — only auth method for customers
      phoneNumber({
        sendOTP: async ({ phoneNumber: phone, code }) => {
          const apiKey = process.env.SPACE_TEL_API_KEY;
          const senderId = process.env.SPACE_TEL_SENDER_ID;

          if (!apiKey || !senderId) {
            console.error(
              "[SMS] SPACE_TEL_API_KEY or SPACE_TEL_SENDER_ID not set — OTP not sent.",
            );
            console.log(`[SMS-MOCK] ${phone} -> ${code}`);
            return;
          }

          // API expects 8801XXXXXXXXX format (no + prefix)
          const contactNumber = phone.replace(/^\+/, "");
          const textBody = `Your Blackkin OTP is ${code}. Valid for 5 minutes. Do not share this code.`;

          try {
            const res = await fetch(
              "https://ccs.massdataltd.com/api/SendSMS/shoot",
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  apiKey,
                  contactNumbers: contactNumber,
                  senderId,
                  textBody,
                  type: "text",
                  label: "transactional",
                }),
              },
            );

            const data = (await res.json()) as {
              code: number;
              shootId?: string;
            };

            if (data.code === 0 || data.code === 4) {
              console.log(
                `[SMS] OTP delivered to ${phone} — shoot: ${data.shootId ?? "-"}`,
              );
            } else {
              console.error(
                `[SMS] Delivery failed for ${phone} — code: ${data.code}`,
              );
            }
          } catch (err) {
            console.error("[SMS] Network error — OTP not sent:", err);
          }
        },
        otpLength: 6,
        expiresIn: 300, // 5 minutes
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
