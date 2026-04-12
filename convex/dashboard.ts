import { query } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "./lib/auth.helpers";
import { aggregateProducts, aggregateOrders, aggregateUsers } from "./lib/aggregates";

export const getStats = query({
  args: {},
  returns: v.object({
    totalCustomers: v.number(),
    totalProducts: v.number(),
    totalCategories: v.number(),
    orders: v.object({
      new: v.number(),
      confirmed: v.number(),
      ready_for_delivery: v.number(),
      in_courier: v.number(),
      cancelled: v.number(),
      completed: v.number(),
      total: v.number(),
    }),
  }),
  handler: async (ctx) => {
    await requireAdmin(ctx);

    const [
      totalCustomers,
      totalProducts,
      newOrders,
      confirmedOrders,
      readyForDeliveryOrders,
      inCourierOrders,
      cancelledOrders,
      completedOrders,
      categories,
    ] = await Promise.all([
      aggregateUsers.count(ctx),
      aggregateProducts.count(ctx),
      aggregateOrders.count(ctx, { namespace: "new" }),
      aggregateOrders.count(ctx, { namespace: "confirmed" }),
      aggregateOrders.count(ctx, { namespace: "ready_for_delivery" }),
      aggregateOrders.count(ctx, { namespace: "in_courier" }),
      aggregateOrders.count(ctx, { namespace: "cancelled" }),
      aggregateOrders.count(ctx, { namespace: "completed" }),
      ctx.db.query("categories").take(200),
    ]);

    return {
      totalCustomers,
      totalProducts,
      totalCategories: categories.length,
      orders: {
        new: newOrders,
        confirmed: confirmedOrders,
        ready_for_delivery: readyForDeliveryOrders,
        in_courier: inCourierOrders,
        cancelled: cancelledOrders,
        completed: completedOrders,
        total:
          newOrders +
          confirmedOrders +
          readyForDeliveryOrders +
          inCourierOrders +
          cancelledOrders +
          completedOrders,
      },
    };
  },
});
