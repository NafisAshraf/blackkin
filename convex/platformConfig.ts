import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { requireAdmin } from "./lib/auth.helpers";

// ─── SIZES ───────────────────────────────────────────────────

export const listSizes = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("platformSizes"),
      _creationTime: v.number(),
      name: v.string(),
      measurements: v.string(),
      sortOrder: v.number(),
    }),
  ),
  handler: async (ctx) => {
    const sizes = await ctx.db.query("platformSizes").order("asc").take(100);
    return [...sizes].sort((a, b) => a.sortOrder - b.sortOrder);
  },
});

export const createSize = mutation({
  args: {
    name: v.string(),
    measurements: v.string(),
    // sortOrder is auto-assigned (max + 1)
  },
  returns: v.id("platformSizes"),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const existing = await ctx.db
      .query("platformSizes")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .unique();
    if (existing) throw new ConvexError("Size already exists");
    const all = await ctx.db.query("platformSizes").order("asc").take(200);
    const maxSort =
      all.length > 0 ? Math.max(...all.map((s) => s.sortOrder)) : -1;
    return await ctx.db.insert("platformSizes", {
      name: args.name,
      measurements: args.measurements,
      sortOrder: maxSort + 1,
    });
  },
});

export const updateSize = mutation({
  args: {
    id: v.id("platformSizes"),
    name: v.optional(v.string()),
    measurements: v.optional(v.string()),
    // sortOrder is now managed via reorderSizes only
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const { id, ...updates } = args;
    const clean = Object.fromEntries(
      Object.entries(updates).filter(([, v]) => v !== undefined),
    );
    if (Object.keys(clean).length > 0) {
      await ctx.db.patch(id, clean);
    }
    return null;
  },
});

export const reorderSizes = mutation({
  args: {
    items: v.array(
      v.object({ id: v.id("platformSizes"), sortOrder: v.number() }),
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await Promise.all(
      args.items.map((item) =>
        ctx.db.patch(item.id, { sortOrder: item.sortOrder }),
      ),
    );
    return null;
  },
});

export const deleteSize = mutation({
  args: { id: v.id("platformSizes") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.delete(args.id);
    return null;
  },
});

// ─── COLORS ──────────────────────────────────────────────────

export const listColors = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("platformColors"),
      _creationTime: v.number(),
      name: v.string(),
      hexCode: v.string(),
      sortOrder: v.number(),
    }),
  ),
  handler: async (ctx) => {
    const colors = await ctx.db.query("platformColors").order("asc").take(100);
    return [...colors].sort((a, b) => a.sortOrder - b.sortOrder);
  },
});

export const createColor = mutation({
  args: {
    name: v.string(),
    hexCode: v.string(), // required
  },
  returns: v.id("platformColors"),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const existing = await ctx.db
      .query("platformColors")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .unique();
    if (existing) throw new ConvexError("Color already exists");
    const all = await ctx.db.query("platformColors").order("asc").take(200);
    const maxSort =
      all.length > 0 ? Math.max(...all.map((c) => c.sortOrder)) : -1;
    return await ctx.db.insert("platformColors", {
      name: args.name,
      hexCode: args.hexCode,
      sortOrder: maxSort + 1,
    });
  },
});

export const updateColor = mutation({
  args: {
    id: v.id("platformColors"),
    name: v.optional(v.string()),
    hexCode: v.optional(v.string()), // optional so partial updates work
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const { id, ...updates } = args;
    const clean = Object.fromEntries(
      Object.entries(updates).filter(([, v]) => v !== undefined),
    );
    if (Object.keys(clean).length > 0) {
      await ctx.db.patch(id, clean);
    }
    return null;
  },
});

export const reorderColors = mutation({
  args: {
    items: v.array(
      v.object({ id: v.id("platformColors"), sortOrder: v.number() }),
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await Promise.all(
      args.items.map((item) =>
        ctx.db.patch(item.id, { sortOrder: item.sortOrder }),
      ),
    );
    return null;
  },
});

export const deleteColor = mutation({
  args: { id: v.id("platformColors") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.delete(args.id);
    return null;
  },
});

// ─── NAVBAR CATEGORIES ───────────────────────────────────────

/** Public: ordered list of categories shown in the navbar */
export const listNavbarCategories = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("navbarCategories")
      .withIndex("by_sortOrder")
      .order("asc")
      .take(20);
    const result = (
      await Promise.all(
        rows.map(async (row) => {
          const cat = await ctx.db.get(row.categoryId);
          if (!cat || !cat.isActive) return null;
          return {
            _id: row._id,
            categoryId: row.categoryId,
            name: cat.name,
            slug: cat.slug,
            sortOrder: row.sortOrder,
          };
        }),
      )
    ).filter(Boolean);
    return result as Array<{
      _id: string;
      categoryId: string;
      name: string;
      slug: string;
      sortOrder: number;
    }>;
  },
});

/** Admin: toggle a category in/out of the navbar */
export const setNavbarCategory = mutation({
  args: { categoryId: v.id("categories"), enabled: v.boolean() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const existing = await ctx.db
      .query("navbarCategories")
      .withIndex("by_categoryId", (q) => q.eq("categoryId", args.categoryId))
      .unique();
    if (args.enabled && !existing) {
      const allRows = await ctx.db
        .query("navbarCategories")
        .order("asc")
        .take(20);
      const maxSort =
        allRows.length > 0 ? Math.max(...allRows.map((r) => r.sortOrder)) : -1;
      await ctx.db.insert("navbarCategories", {
        categoryId: args.categoryId,
        sortOrder: maxSort + 1,
      });
    } else if (!args.enabled && existing) {
      await ctx.db.delete(existing._id);
    }
    return null;
  },
});

/** Admin: reorder navbar categories */
export const reorderNavbarCategories = mutation({
  args: {
    items: v.array(
      v.object({ id: v.id("navbarCategories"), sortOrder: v.number() }),
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await Promise.all(
      args.items.map((item) =>
        ctx.db.patch(item.id, { sortOrder: item.sortOrder }),
      ),
    );
    return null;
  },
});

// ─── PREDEFINED SEARCH QUERIES ───────────────────────────────

/** Public: active predefined search queries ordered by sortOrder */
export const listPredefinedSearchQueries = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db
      .query("predefinedSearchQueries")
      .order("asc")
      .take(30);
    return [...all]
      .filter((q) => q.isActive)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  },
});

/** Admin: all predefined search queries (including inactive) */
export const listAllPredefinedSearchQueries = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const all = await ctx.db
      .query("predefinedSearchQueries")
      .order("asc")
      .take(30);
    return [...all].sort((a, b) => a.sortOrder - b.sortOrder);
  },
});

export const createPredefinedSearchQuery = mutation({
  args: { query: v.string() },
  returns: v.id("predefinedSearchQueries"),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const all = await ctx.db
      .query("predefinedSearchQueries")
      .order("asc")
      .take(30);
    const maxSort =
      all.length > 0 ? Math.max(...all.map((q) => q.sortOrder)) : -1;
    return await ctx.db.insert("predefinedSearchQueries", {
      query: args.query,
      sortOrder: maxSort + 1,
      isActive: true,
    });
  },
});

export const updatePredefinedSearchQuery = mutation({
  args: {
    id: v.id("predefinedSearchQueries"),
    query: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const { id, ...updates } = args;
    const clean = Object.fromEntries(
      Object.entries(updates).filter(([, val]) => val !== undefined),
    );
    if (Object.keys(clean).length > 0) await ctx.db.patch(id, clean);
    return null;
  },
});

export const deletePredefinedSearchQuery = mutation({
  args: { id: v.id("predefinedSearchQueries") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.delete(args.id);
    return null;
  },
});

export const reorderPredefinedSearchQueries = mutation({
  args: {
    items: v.array(
      v.object({ id: v.id("predefinedSearchQueries"), sortOrder: v.number() }),
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await Promise.all(
      args.items.map((item) =>
        ctx.db.patch(item.id, { sortOrder: item.sortOrder }),
      ),
    );
    return null;
  },
});
