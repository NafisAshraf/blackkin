import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// The schema is entirely optional.
// You can delete this file (schema.ts) and the
// app will continue to work.
// The schema provides more precise TypeScript types.
export default defineSchema({
  numbers: defineTable({
    value: v.number(),
  }),
  users: defineTable({
    authUserId: v.string(),
    name: v.optional(v.string()),
    email: v.string(),
  }).index("by_authUserId", ["authUserId"]),
});
