import { ConvexError } from "convex/values";
import { Doc, Id } from "../_generated/dataModel";
import { MutationCtx } from "../_generated/server";
import { getActiveSizeMaps, isSelectableVariant } from "./variantSizes";
import { OrderStatus } from "./validators";

export type InventoryState = "deducted" | "restored";

export function isInventoryReleasedStatus(status: OrderStatus) {
  return status === "cancelled" || status === "deleted";
}

export function getOrderInventoryState(
  order: Doc<"orders">,
): InventoryState | null {
  if (order.inventoryState) return order.inventoryState;
  return isInventoryReleasedStatus(order.status) ? null : "deducted";
}

type GroupedOrderItem = {
  variantId: Id<"productVariants">;
  quantity: number;
  label: string;
};

async function getGroupedOrderItems(
  ctx: MutationCtx,
  orderId: Id<"orders">,
): Promise<GroupedOrderItem[]> {
  const items = await ctx.db
    .query("orderItems")
    .withIndex("by_orderId", (q) => q.eq("orderId", orderId))
    .collect();
  const grouped = new Map<string, GroupedOrderItem>();

  for (const item of items) {
    const key = item.variantId as string;
    const label = [item.productName, item.color, item.size]
      .filter(Boolean)
      .join(" / ");
    const existing = grouped.get(key);
    if (existing) {
      existing.quantity += item.quantity;
    } else {
      grouped.set(key, {
        variantId: item.variantId,
        quantity: item.quantity,
        label,
      });
    }
  }

  return [...grouped.values()];
}

export async function transitionOrderInventory(
  ctx: MutationCtx,
  order: Doc<"orders">,
  targetStatus: OrderStatus,
  reason: string,
) {
  const currentState = getOrderInventoryState(order);
  if (!currentState) {
    throw new ConvexError(
      "This legacy order needs an inventory audit before its status can change.",
    );
  }

  const targetState: InventoryState = isInventoryReleasedStatus(targetStatus)
    ? "restored"
    : "deducted";
  const now = Date.now();

  if (currentState === targetState) {
    return order.inventoryState
      ? {}
      : {
          inventoryState: currentState,
          inventoryStateChangedAt: now,
          inventoryStateReason: "legacy_active_order_backfill",
        };
  }

  const groupedItems = await getGroupedOrderItems(ctx, order._id);
  const sizeMaps =
    targetState === "deducted" ? await getActiveSizeMaps(ctx) : null;
  const updates: Array<{
    variant: Doc<"productVariants">;
    quantity: number;
    label: string;
  }> = [];

  for (const item of groupedItems) {
    const variant = await ctx.db.get(item.variantId);
    if (!variant) {
      throw new ConvexError(
        `Cannot update inventory for ${item.label}: variant no longer exists.`,
      );
    }
    if (
      targetState === "deducted" &&
      (!sizeMaps || !isSelectableVariant(variant, sizeMaps))
    ) {
      throw new ConvexError(
        `Cannot reactivate this order because ${item.label} is unavailable.`,
      );
    }
    if (targetState === "deducted" && variant.stock < item.quantity) {
      throw new ConvexError(
        `Not enough stock for ${item.label}. Required ${item.quantity}, available ${variant.stock}.`,
      );
    }
    updates.push({ variant, quantity: item.quantity, label: item.label });
  }

  for (const update of updates) {
    await ctx.db.patch(update.variant._id, {
      stock:
        targetState === "restored"
          ? update.variant.stock + update.quantity
          : update.variant.stock - update.quantity,
    });
  }

  return {
    inventoryState: targetState,
    inventoryStateChangedAt: now,
    inventoryStateReason: reason,
  };
}

export async function restoreLegacyOrderInventory(
  ctx: MutationCtx,
  order: Doc<"orders">,
  reason: string,
  options: { allowMissingVariants?: boolean } = {},
) {
  const groupedItems = await getGroupedOrderItems(ctx, order._id);
  const variants: Array<{
    variant: Doc<"productVariants">;
    quantity: number;
  }> = [];
  const skippedMissingVariants: Array<{ label: string; quantity: number }> = [];

  for (const item of groupedItems) {
    const variant = await ctx.db.get(item.variantId);
    if (!variant) {
      if (options.allowMissingVariants) {
        skippedMissingVariants.push({
          label: item.label,
          quantity: item.quantity,
        });
        continue;
      }
      throw new ConvexError(
        `Cannot restore ${item.label}: variant no longer exists.`,
      );
    }
    variants.push({ variant, quantity: item.quantity });
  }

  for (const { variant, quantity } of variants) {
    await ctx.db.patch(variant._id, { stock: variant.stock + quantity });
  }

  await ctx.db.patch(order._id, {
    inventoryState: "restored",
    inventoryStateChangedAt: Date.now(),
    inventoryStateReason: reason,
  });

  return { skippedMissingVariants };
}
