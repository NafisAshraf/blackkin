import { Triggers } from "convex-helpers/server/triggers";
import { customMutation, customCtx } from "convex-helpers/server/customFunctions";
import { mutation as rawMutation } from "./_generated/server";
import { DataModel } from "./_generated/dataModel";
import { components } from "./_generated/api";

const triggers = new Triggers<DataModel>();

// When a user is deleted from our `users` table (via a Convex mutation),
// cascade the deletion to the better-auth component — removing sessions,
// accounts/credentials, and the user record itself.
//
// NOTE: Direct dashboard deletions bypass Convex functions entirely and
// therefore cannot fire these triggers. This only applies to programmatic
// Convex mutations that use the `mutation` export below.
triggers.register("users", async (ctx, change) => {
  if (change.operation !== "delete") return;

  const { authUserId } = change.oldDoc;

  // SECURITY GUARD: Ensure authUserId is a valid, non-empty string.
  // If it's missing or somehow not a string, abort immediately to prevent
  // the risk of a malformed query matching against empty fields and
  // accidentally deleting other users' data.
  if (!authUserId || typeof authUserId !== "string" || authUserId.trim() === "") {
    console.warn(`Skipping better-auth cleanup for user with invalid authUserId: ${authUserId}`);
    return;
  }

  // The better-auth schema includes several tables that reference `userId`.
  // We clean them all up to prevent orphaned auth data.
  const tablesWithUserId = [
    "session",
    "account",
    "twoFactor",
    "oauthConsent",
    "oauthAccessToken",
    "oauthApplication",
  ] as const;

  for (const model of tablesWithUserId) {
    await ctx.runMutation(
      components.betterAuth.adapter.deleteMany,
      { input: { model, where: [{ field: "userId", value: authUserId }] } } as any,
    );
  }

  // Finally, remove the user record itself from better-auth
  await ctx.runMutation(
    components.betterAuth.adapter.deleteOne,
    { input: { model: "user", where: [{ field: "_id", value: authUserId }] } } as any,
  );
});

/**
 * Use this `mutation` instead of the raw one for any mutation that writes to
 * the `users` table, so that the delete trigger fires automatically.
 */
export const mutation = customMutation(rawMutation, customCtx(triggers.wrapDB));
