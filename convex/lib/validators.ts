import { v } from "convex/values";

export const orderStatusValidator = v.union(
  v.literal("new"),
  v.literal("confirmed"),
  v.literal("ready_for_delivery"),
  v.literal("in_courier"),
  v.literal("cancelled"),
  v.literal("hold"),
  v.literal("ship_later"),
  v.literal("paid"),
  v.literal("deleted"),
  v.literal("completed")
);

export type OrderStatus =
  | "new"
  | "confirmed"
  | "ready_for_delivery"
  | "in_courier"
  | "cancelled"
  | "hold"
  | "ship_later"
  | "paid"
  | "deleted"
  | "completed";

export const ORDER_STATUS_LIST: OrderStatus[] = [
  "new",
  "confirmed",
  "ready_for_delivery",
  "in_courier",
  "cancelled",
  "hold",
  "ship_later",
  "paid",
  "deleted",
  "completed",
];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  new: "New Orders",
  confirmed: "Confirmed",
  ready_for_delivery: "Ready for Delivery",
  in_courier: "In-Courier",
  cancelled: "Cancelled",
  hold: "Hold",
  ship_later: "Ship Later",
  paid: "Paid",
  deleted: "Deleted",
  completed: "Completed",
};
