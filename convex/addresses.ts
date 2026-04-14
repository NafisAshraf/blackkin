import { query, mutation } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { requireAuth } from "./lib/auth.helpers";

const addressObject = v.object({
  _id: v.id("userAddresses"),
  _creationTime: v.number(),
  userId: v.id("users"),
  type: v.union(v.literal("home"), v.literal("work")),
  name: v.string(),
  phone: v.string(),
  address: v.string(),
});

/** Get the current user's saved addresses (max 2 — one home, one work) */
export const getSavedAddresses = query({
  args: {},
  returns: v.array(addressObject),
  handler: async (ctx) => {
    const user = await requireAuth(ctx);
    return await ctx.db
      .query("userAddresses")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .take(2);
  },
});

/** Upsert a saved address by type. If one already exists for that type, update it. */
export const saveAddress = mutation({
  args: {
    type: v.union(v.literal("home"), v.literal("work")),
    name: v.string(),
    phone: v.string(),
    address: v.string(),
  },
  returns: v.id("userAddresses"),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    const existing = await ctx.db
      .query("userAddresses")
      .withIndex("by_userId_and_type", (q) =>
        q.eq("userId", user._id).eq("type", args.type)
      )
      .unique();

    const fields = {
      userId: user._id,
      type: args.type,
      name: args.name,
      phone: args.phone,
      address: args.address,
    };

    if (existing) {
      await ctx.db.patch(existing._id, fields);
      return existing._id;
    } else {
      return await ctx.db.insert("userAddresses", fields);
    }
  },
});

/** Delete a saved address. Validates ownership before deleting. */
export const deleteAddress = mutation({
  args: { addressId: v.id("userAddresses") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const address = await ctx.db.get(args.addressId);
    if (!address || address.userId !== user._id) {
      throw new ConvexError("Address not found");
    }
    await ctx.db.delete(args.addressId);
    return null;
  },
});
