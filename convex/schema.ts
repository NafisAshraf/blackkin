import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    authUserId: v.string(),
    name: v.optional(v.string()),
    email: v.string(),
    role: v.union(v.literal("customer"), v.literal("admin")),
  }).index("by_authUserId", ["authUserId"]),
});
