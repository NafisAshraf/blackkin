import { v, ConvexError } from "convex/values";
import { internalQuery } from "./_generated/server";
import { internalMutation } from "./triggers";
import { aggregateOrders } from "./lib/aggregates";
import { ORDER_STATUS_LIST } from "./lib/validators";
import {
  isInventoryReleasedStatus,
  restoreLegacyOrderInventory,
  transitionOrderInventory,
} from "./lib/orderInventory";

const legacyResolutionValidator = v.object({
  orderId: v.id("orders"),
  currentPhysicalState: v.union(v.literal("deducted"), v.literal("restored")),
});

export const audit = internalQuery({
  args: {},
  handler: async (ctx) => {
    const orders = await ctx.db.query("orders").collect();
    const actualByStatus = Object.fromEntries(
      ORDER_STATUS_LIST.map((status) => [status, { count: 0, totalAmount: 0 }]),
    );
    const legacyOrders = [];

    for (const order of orders) {
      actualByStatus[order.status].count += 1;
      actualByStatus[order.status].totalAmount += order.total;
      if (order.inventoryState) continue;

      const payments = await ctx.db
        .query("payments")
        .withIndex("by_orderId", (q) => q.eq("orderId", order._id))
        .collect();
      const items = await ctx.db
        .query("orderItems")
        .withIndex("by_orderId", (q) => q.eq("orderId", order._id))
        .collect();
      const missingVariantItems = [];
      for (const item of items) {
        if (!(await ctx.db.get(item.variantId))) {
          missingVariantItems.push({
            productName: item.productName,
            color: item.color,
            size: item.size,
            quantity: item.quantity,
          });
        }
      }
      const isOnline = Boolean(
        order.paymentMethod && order.paymentMethod !== "cod",
      );
      legacyOrders.push({
        orderId: order._id,
        orderNumber: order.orderNumber,
        status: order.status,
        paymentMethod: order.paymentMethod ?? "cod",
        paymentStatuses: payments.map((payment) => payment.status),
        releasedStatus: isInventoryReleasedStatus(order.status),
        requiresPhysicalStateResolution: isOnline && payments.length === 0,
        defaultPhysicalState:
          !isOnline || payments.length > 0 ? ("deducted" as const) : null,
        missingVariantItems,
      });
    }

    const storedByStatus = await Promise.all(
      ORDER_STATUS_LIST.map(async (status) => {
        const count = await aggregateOrders.count(ctx, { namespace: status });
        const amount = await ctx.db
          .query("orderStatusAmounts")
          .withIndex("by_status", (q) => q.eq("status", status))
          .unique();
        return {
          status,
          count,
          totalAmount: amount?.totalAmount ?? 0,
        };
      }),
    );

    return {
      orderCount: orders.length,
      legacyOrderCount: legacyOrders.length,
      actualByStatus,
      storedByStatus,
      legacyOrders,
    };
  },
});

export const migrateLegacyInventory = internalMutation({
  args: {
    expectedLegacyOrderCount: v.number(),
    resolutions: v.array(legacyResolutionValidator),
  },
  handler: async (ctx, args) => {
    const orders = await ctx.db.query("orders").collect();
    const legacyOrders = orders.filter((order) => !order.inventoryState);
    if (legacyOrders.length !== args.expectedLegacyOrderCount) {
      throw new ConvexError(
        `Legacy order count changed. Expected ${args.expectedLegacyOrderCount}, found ${legacyOrders.length}. Run the audit again.`,
      );
    }

    const resolutions = new Map(
      args.resolutions.map((resolution) => [
        resolution.orderId as string,
        resolution.currentPhysicalState,
      ]),
    );
    const results = [];

    for (const order of legacyOrders) {
      const payments = await ctx.db
        .query("payments")
        .withIndex("by_orderId", (q) => q.eq("orderId", order._id))
        .collect();
      const isOnline = Boolean(
        order.paymentMethod && order.paymentMethod !== "cod",
      );
      const explicitResolution = resolutions.get(order._id as string);
      if (isOnline && payments.length === 0 && !explicitResolution) {
        throw new ConvexError(
          `Order #${order.orderNumber} needs an explicit physical inventory-state resolution.`,
        );
      }

      const physicalState =
        explicitResolution ?? ("deducted" as "deducted" | "restored");
      const targetReleased = isInventoryReleasedStatus(order.status);

      if (targetReleased && physicalState === "deducted") {
        const restoration = await restoreLegacyOrderInventory(
          ctx,
          order,
          "legacy_released_order_repair",
          { allowMissingVariants: true },
        );
        results.push({
          orderNumber: order.orderNumber,
          action: "restored",
          skippedMissingVariants: restoration.skippedMissingVariants,
        });
      } else if (!targetReleased && physicalState === "restored") {
        const patch = await transitionOrderInventory(
          ctx,
          { ...order, inventoryState: "restored" },
          order.status,
          "legacy_active_order_repair",
        );
        await ctx.db.patch(order._id, patch);
        results.push({
          orderNumber: order.orderNumber,
          action: "deducted",
          skippedMissingVariants: [],
        });
      } else {
        await ctx.db.patch(order._id, {
          inventoryState: targetReleased ? "restored" : "deducted",
          inventoryStateChangedAt: Date.now(),
          inventoryStateReason: "legacy_inventory_state_backfill",
        });
        results.push({
          orderNumber: order.orderNumber,
          action: "marked",
          skippedMissingVariants: [],
        });
      }
    }

    return { migratedOrderCount: results.length, results };
  },
});

export const repairBookkeeping = internalMutation({
  args: { expectedOrderCount: v.number() },
  handler: async (ctx, args) => {
    const orders = await ctx.db.query("orders").collect();
    if (orders.length !== args.expectedOrderCount) {
      throw new ConvexError(
        `Order count changed. Expected ${args.expectedOrderCount}, found ${orders.length}. Run the audit again.`,
      );
    }

    for (const status of ORDER_STATUS_LIST) {
      await aggregateOrders.clear(ctx, { namespace: status });
    }
    for (const amount of await ctx.db.query("orderStatusAmounts").collect()) {
      await ctx.db.delete(amount._id);
    }

    const totals = new Map<string, number>();
    for (const order of orders) {
      await aggregateOrders.insertIfDoesNotExist(ctx, order);
      totals.set(order.status, (totals.get(order.status) ?? 0) + order.total);
    }
    for (const status of ORDER_STATUS_LIST) {
      await ctx.db.insert("orderStatusAmounts", {
        status,
        totalAmount: totals.get(status) ?? 0,
      });
    }

    return {
      orderCount: orders.length,
      counts: Object.fromEntries(
        ORDER_STATUS_LIST.map((status) => [
          status,
          orders.filter((order) => order.status === status).length,
        ]),
      ),
    };
  },
});
