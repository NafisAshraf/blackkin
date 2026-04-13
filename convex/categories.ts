import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { requireAdmin } from "./lib/auth.helpers";

const categoryObject = v.object({
  _id: v.id("categories"),
  _creationTime: v.number(),
  name: v.string(),
  slug: v.string(),
  description: v.optional(v.string()),
  imageId: v.optional(v.string()),
  isActive: v.boolean(),
  sortOrder: v.number(),
});

/** Active categories for storefront filters & display */
export const list = query({
  args: {},
  returns: v.array(categoryObject),
  handler: async (ctx) => {
    const cats = await ctx.db
      .query("categories")
      .withIndex("by_isActive", (q) => q.eq("isActive", true))
      .take(100);
    return [...cats].sort((a, b) => a.sortOrder - b.sortOrder);
  },
});

/** Admin: all categories including inactive */
export const listAll = query({
  args: {},
  returns: v.array(categoryObject),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const cats = await ctx.db.query("categories").order("asc").take(200);
    return [...cats].sort((a, b) => a.sortOrder - b.sortOrder);
  },
});

/** Single category by slug */
export const getBySlug = query({
  args: { slug: v.string() },
  returns: v.union(categoryObject, v.null()),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("categories")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    slug: v.string(),
    description: v.optional(v.string()),
    imageId: v.optional(v.string()),
    // sortOrder is auto-assigned (max + 1)
  },
  returns: v.id("categories"),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const existing = await ctx.db
      .query("categories")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
    if (existing) throw new ConvexError("Slug already in use");
    const all = await ctx.db.query("categories").order("asc").take(200);
    const maxSort = all.length > 0 ? Math.max(...all.map((c) => c.sortOrder)) : -1;
    return await ctx.db.insert("categories", {
      ...args,
      isActive: true,
      sortOrder: maxSort + 1,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("categories"),
    name: v.optional(v.string()),
    slug: v.optional(v.string()),
    description: v.optional(v.string()),
    imageId: v.optional(v.string()),
    // sortOrder is now managed via reorder only
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const { id, ...updates } = args;
    if (updates.slug) {
      const existing = await ctx.db
        .query("categories")
        .withIndex("by_slug", (q) => q.eq("slug", updates.slug!))
        .unique();
      if (existing && existing._id !== id) throw new ConvexError("Slug already in use");
    }
    const clean = Object.fromEntries(
      Object.entries(updates).filter(([, v]) => v !== undefined)
    );
    if (Object.keys(clean).length > 0) await ctx.db.patch(id, clean);
    return null;
  },
});

export const reorder = mutation({
  args: {
    items: v.array(v.object({ id: v.id("categories"), sortOrder: v.number() })),
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

export const toggleActive = mutation({
  args: { id: v.id("categories"), isActive: v.boolean() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.patch(args.id, { isActive: args.isActive });
    return null;
  },
});

export const remove = mutation({
  args: { id: v.id("categories") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    // Unlink any products in this category (set categoryId to undefined)
    const products = await ctx.db
      .query("products")
      .withIndex("by_categoryId_and_categorySortOrder", (q) =>
        q.eq("categoryId", args.id)
      )
      .take(500);
    await Promise.all(
      products.map((p) => ctx.db.patch(p._id, { categoryId: undefined }))
    );
    await ctx.db.delete(args.id);
    return null;
  },
});
