import { query, mutation } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { requireAdmin } from "./lib/auth.helpers";

const discountTypeValidator = v.union(v.literal("percentage"), v.literal("fixed"));

const groupObject = v.object({
  _id: v.id("discountGroups"),
  _creationTime: v.number(),
  name: v.string(),
  isActive: v.boolean(),
  discountType: discountTypeValidator,
  discountValue: v.number(),
  startTime: v.number(),
  endTime: v.optional(v.number()),
  sortOrder: v.number(),
});

// ─── QUERIES ───────────────────────────────────────────────

/** Admin: all discount groups with product counts */
export const listAll = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("discountGroups"),
      _creationTime: v.number(),
      name: v.string(),
      isActive: v.boolean(),
      discountType: discountTypeValidator,
      discountValue: v.number(),
      startTime: v.number(),
      endTime: v.optional(v.number()),
      sortOrder: v.number(),
      productCount: v.number(),
    })
  ),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const groups = await ctx.db.query("discountGroups").withIndex("by_sortOrder").order("asc").take(200);

    return await Promise.all(
      groups.map(async (group) => {
        const count = await ctx.db
          .query("discountGroupProducts")
          .withIndex("by_groupId", (q) => q.eq("groupId", group._id))
          .take(500);
        return { ...group, productCount: count.length };
      })
    );
  },
});

/** Admin: all products in a discount group */
export const listProductsInGroup = query({
  args: { groupId: v.id("discountGroups") },
  returns: v.array(
    v.object({
      _id: v.id("discountGroupProducts"),
      groupId: v.id("discountGroups"),
      productId: v.id("products"),
      productName: v.string(),
      productSlug: v.string(),
      basePrice: v.number(),
      sortOrder: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const rows = await ctx.db
      .query("discountGroupProducts")
      .withIndex("by_groupId_and_sortOrder", (q) => q.eq("groupId", args.groupId))
      .order("asc")
      .take(500);

    return (
      await Promise.all(
        rows.map(async (row) => {
          const product = await ctx.db.get(row.productId);
          if (!product) return null;
          return {
            _id: row._id,
            groupId: row.groupId,
            productId: row.productId,
            productName: product.name,
            productSlug: product.slug,
            basePrice: product.basePrice,
            sortOrder: row.sortOrder,
          };
        })
      )
    ).filter(Boolean) as Awaited<ReturnType<typeof ctx.db.get<"discountGroupProducts">>> extends null
      ? never[]
      : any[];
  },
});

/** Admin: flat list of all group memberships — used by admin products page for discounts tab */
export const listAllGroupMemberships = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("discountGroupProducts"),
      _creationTime: v.number(),
      groupId: v.id("discountGroups"),
      productId: v.id("products"),
      sortOrder: v.number(),
    })
  ),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return await ctx.db.query("discountGroupProducts").order("asc").take(2000);
  },
});

/** Get the group IDs a product belongs to */
export const getGroupsForProduct = query({
  args: { productId: v.id("products") },
  returns: v.array(v.id("discountGroups")),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const rows = await ctx.db
      .query("discountGroupProducts")
      .withIndex("by_productId", (q) => q.eq("productId", args.productId))
      .take(50);
    return rows.map((r) => r.groupId);
  },
});

// ─── MUTATIONS ─────────────────────────────────────────────

export const create = mutation({
  args: {
    name: v.string(),
    discountType: discountTypeValidator,
    discountValue: v.number(),
    startTime: v.number(),
    endTime: v.optional(v.number()),
    isActive: v.optional(v.boolean()),
  },
  returns: v.id("discountGroups"),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    if (args.discountValue <= 0) throw new ConvexError("Discount value must be positive");
    if (args.discountType === "percentage" && args.discountValue > 100) {
      throw new ConvexError("Percentage discount cannot exceed 100%");
    }
    if (args.endTime !== undefined && args.endTime <= args.startTime) {
      throw new ConvexError("End time must be after start time");
    }

    // Auto-assign sortOrder: place at end of list
    const existing = await ctx.db.query("discountGroups").withIndex("by_sortOrder").order("desc").take(1);
    const sortOrder = existing.length > 0 ? existing[0].sortOrder + 1 : 0;

    return await ctx.db.insert("discountGroups", {
      name: args.name,
      discountType: args.discountType,
      discountValue: args.discountValue,
      startTime: args.startTime,
      endTime: args.endTime,
      isActive: args.isActive ?? true,
      sortOrder,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("discountGroups"),
    name: v.optional(v.string()),
    discountType: v.optional(discountTypeValidator),
    discountValue: v.optional(v.number()),
    startTime: v.optional(v.number()),
    endTime: v.optional(v.number()),
    isActive: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const { id, ...updates } = args;
    const current = await ctx.db.get(id);
    if (!current) throw new ConvexError("Discount group not found");

    const discountType = updates.discountType ?? current.discountType;
    const discountValue = updates.discountValue ?? current.discountValue;

    if (discountValue <= 0) throw new ConvexError("Discount value must be positive");
    if (discountType === "percentage" && discountValue > 100) {
      throw new ConvexError("Percentage discount cannot exceed 100%");
    }

    const startTime = updates.startTime ?? current.startTime;
    const endTime = updates.endTime ?? current.endTime;
    if (endTime !== undefined && endTime <= startTime) {
      throw new ConvexError("End time must be after start time");
    }

    const clean = Object.fromEntries(
      Object.entries(updates).filter(([, v]) => v !== undefined)
    );
    if (Object.keys(clean).length > 0) await ctx.db.patch(id, clean);
    return null;
  },
});

export const toggleActive = mutation({
  args: { id: v.id("discountGroups"), isActive: v.boolean() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.patch(args.id, { isActive: args.isActive });
    return null;
  },
});

export const remove = mutation({
  args: { id: v.id("discountGroups") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    // Delete all product associations
    let done = false;
    while (!done) {
      const rows = await ctx.db
        .query("discountGroupProducts")
        .withIndex("by_groupId", (q) => q.eq("groupId", args.id))
        .take(64);
      if (rows.length === 0) {
        done = true;
      } else {
        await Promise.all(rows.map((r) => ctx.db.delete(r._id)));
      }
    }
    await ctx.db.delete(args.id);
    return null;
  },
});

/** Add products to a discount group (idempotent) */
export const addProducts = mutation({
  args: {
    groupId: v.id("discountGroups"),
    productIds: v.array(v.id("products")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const group = await ctx.db.get(args.groupId);
    if (!group) throw new ConvexError("Discount group not found");

    for (const productId of args.productIds) {
      const existing = await ctx.db
        .query("discountGroupProducts")
        .withIndex("by_groupId_and_productId", (q) =>
          q.eq("groupId", args.groupId).eq("productId", productId)
        )
        .unique();
      if (!existing) {
        // Auto-assign sortOrder: place at end of this group
        const last = await ctx.db
          .query("discountGroupProducts")
          .withIndex("by_groupId_and_sortOrder", (q) => q.eq("groupId", args.groupId))
          .order("desc")
          .take(1);
        const sortOrder = last.length > 0 ? last[0].sortOrder + 1 : 0;
        await ctx.db.insert("discountGroupProducts", {
          groupId: args.groupId,
          productId,
          sortOrder,
        });
      }
    }
    return null;
  },
});

/** Remove a product from a discount group */
export const removeProduct = mutation({
  args: {
    groupId: v.id("discountGroups"),
    productId: v.id("products"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const row = await ctx.db
      .query("discountGroupProducts")
      .withIndex("by_groupId_and_productId", (q) =>
        q.eq("groupId", args.groupId).eq("productId", args.productId)
      )
      .unique();
    if (row) await ctx.db.delete(row._id);
    return null;
  },
});

/** Remove multiple products from all their discount groups */
export const removeProductsFromAllGroups = mutation({
  args: {
    productIds: v.array(v.id("products")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    for (const productId of args.productIds) {
      const rows = await ctx.db
        .query("discountGroupProducts")
        .withIndex("by_productId", (q) => q.eq("productId", productId))
        .collect();
      for (const row of rows) {
        await ctx.db.delete(row._id);
      }
    }
    return null;
  },
});

/** Reorder discount groups (update sortOrder for each group) */
export const reorderGroups = mutation({
  args: {
    items: v.array(v.object({ id: v.id("discountGroups"), sortOrder: v.number() })),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await Promise.all(
      args.items.map((item) => ctx.db.patch(item.id, { sortOrder: item.sortOrder }))
    );
    return null;
  },
});

/** Reorder products within a discount group (update sortOrder on the junction doc) */
export const reorderProductsInGroup = mutation({
  args: {
    items: v.array(v.object({ membershipId: v.id("discountGroupProducts"), sortOrder: v.number() })),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await Promise.all(
      args.items.map((item) => ctx.db.patch(item.membershipId, { sortOrder: item.sortOrder }))
    );
    return null;
  },
});
