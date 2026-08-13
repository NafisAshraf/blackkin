import { Triggers } from "convex-helpers/server/triggers";
import {
  customMutation,
  customCtx,
} from "convex-helpers/server/customFunctions";
import { GenericMutationCtx } from "convex/server";
import {
  mutation as rawMutation,
  internalMutation as rawInternalMutation,
} from "./_generated/server";
import { DataModel } from "./_generated/dataModel";
import { components } from "./_generated/api";
import { aggregateOrders, aggregateUsers } from "./lib/aggregates";

const triggers = new Triggers<DataModel>();

async function adjustOrderStatusAmount(
  ctx: GenericMutationCtx<DataModel>,
  status: string,
  delta: number,
) {
  if (delta === 0) return;
  const existing = await ctx.db
    .query("orderStatusAmounts")
    .withIndex("by_status", (q) => q.eq("status", status))
    .unique();
  if (existing) {
    await ctx.db.patch(existing._id, {
      totalAmount: Math.max(0, existing.totalAmount + delta),
    });
  } else if (delta > 0) {
    await ctx.db.insert("orderStatusAmounts", { status, totalAmount: delta });
  }
}

// Keep order counts and amounts synchronized for every public/internal write.
triggers.register("orders", async (ctx, change) => {
  if (change.operation === "insert") {
    await aggregateOrders.insertIfDoesNotExist(ctx, change.newDoc);
    await adjustOrderStatusAmount(
      ctx,
      change.newDoc.status,
      change.newDoc.total,
    );
    return;
  }

  if (change.operation === "delete") {
    await aggregateOrders.deleteIfExists(ctx, change.oldDoc);
    await adjustOrderStatusAmount(
      ctx,
      change.oldDoc.status,
      -change.oldDoc.total,
    );
    return;
  }

  const statusChanged = change.oldDoc.status !== change.newDoc.status;
  const totalChanged = change.oldDoc.total !== change.newDoc.total;
  if (!statusChanged && !totalChanged) return;

  if (statusChanged) {
    await aggregateOrders.replaceOrInsert(ctx, change.oldDoc, change.newDoc);
    await adjustOrderStatusAmount(
      ctx,
      change.oldDoc.status,
      -change.oldDoc.total,
    );
    await adjustOrderStatusAmount(
      ctx,
      change.newDoc.status,
      change.newDoc.total,
    );
  } else {
    await adjustOrderStatusAmount(
      ctx,
      change.newDoc.status,
      change.newDoc.total - change.oldDoc.total,
    );
  }
});

// ─── USERS: cascade deletion to better-auth + aggregate sync ────
triggers.register("users", async (ctx, change) => {
  // Keep aggregate in sync
  if (change.operation === "insert") {
    if (change.newDoc.role === "customer") {
      await aggregateUsers.insertIfDoesNotExist(ctx, change.newDoc);
    }
  } else if (change.operation === "update") {
    // Role could change (unlikely but guard it)
    if (change.oldDoc.role === "customer") {
      await aggregateUsers.deleteIfExists(ctx, change.oldDoc);
    }
    if (change.newDoc.role === "customer") {
      await aggregateUsers.insertIfDoesNotExist(ctx, change.newDoc);
    }
  } else if (change.operation === "delete") {
    if (change.oldDoc.role === "customer") {
      await aggregateUsers.deleteIfExists(ctx, change.oldDoc);
    }

    const { authUserId } = change.oldDoc;

    if (
      !authUserId ||
      typeof authUserId !== "string" ||
      authUserId.trim() === ""
    ) {
      console.warn(
        `Skipping better-auth cleanup for user with invalid authUserId: ${authUserId}`,
      );
      return;
    }

    // Cascade deletion to better-auth tables
    const tablesWithUserId = [
      "session",
      "account",
      "twoFactor",
      "oauthConsent",
      "oauthAccessToken",
      "oauthApplication",
    ] as const;

    for (const model of tablesWithUserId) {
      // Better Auth's dynamic adapter model union is broader than its generated component type.
      await ctx.runMutation(components.betterAuth.adapter.deleteMany, {
        input: { model, where: [{ field: "userId", value: authUserId }] },
      } as any); // eslint-disable-line @typescript-eslint/no-explicit-any
    }

    await ctx.runMutation(components.betterAuth.adapter.deleteOne, {
      input: { model: "user", where: [{ field: "_id", value: authUserId }] },
    } as any); // eslint-disable-line @typescript-eslint/no-explicit-any
  }
});

/**
 * Use this `mutation` instead of the raw one for any mutation that writes to
 * the `users` table, so that the delete trigger fires automatically.
 */
export const mutation = customMutation(rawMutation, customCtx(triggers.wrapDB));
export const internalMutation = customMutation(
  rawInternalMutation,
  customCtx(triggers.wrapDB),
);
