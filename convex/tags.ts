import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { requireAdmin } from "./lib/auth.helpers";

const tagObject = v.object({
  _id: v.id("tags"),
  _creationTime: v.number(),
  name: v.string(),
  slug: v.string(),
  isActive: v.boolean(),
});

/** Active tags for storefront filters */
export const list = query({
  args: {},
  returns: v.array(tagObject),
  handler: async (ctx) => {
    return await ctx.db
      .query("tags")
      .withIndex("by_isActive", (q) => q.eq("isActive", true))
      .take(200);
  },
});

/** Admin: all tags */
export const listAll = query({
  args: {},
  returns: v.array(tagObject),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return await ctx.db.query("tags").order("asc").take(200);
  },
});

export const create = mutation({
  args: { name: v.string(), slug: v.string() },
  returns: v.id("tags"),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const existing = await ctx.db
      .query("tags")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
    if (existing) throw new ConvexError("Slug already in use");
    return await ctx.db.insert("tags", { ...args, isActive: true });
  },
});

/** Rename a tag — does NOT affect products that have this tag */
export const update = mutation({
  args: {
    id: v.id("tags"),
    name: v.optional(v.string()),
    slug: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const { id, ...updates } = args;
    if (updates.slug) {
      const existing = await ctx.db
        .query("tags")
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

/**
 * Safely delete a tag:
 * 1. Removes all productTags rows that reference this tag
 * 2. Deletes the tag itself
 * Products are NOT deleted.
 */
export const remove = mutation({
  args: { id: v.id("tags") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    // Remove all product-tag associations in batches
    let done = false;
    while (!done) {
      const rows = await ctx.db
        .query("productTags")
        .withIndex("by_tagId", (q) => q.eq("tagId", args.id))
        .take(64);
      if (rows.length === 0) {
        done = true;
      } else {
        await Promise.all(rows.map((r) => ctx.db.delete(r._id)));
      }
    }

    // Clear landing page sections that used this tag
    const sectionsWithTag = await ctx.db
      .query("landingPageProductSections")
      .withIndex("by_tagId", (q) => q.eq("tagId", args.id))
      .collect();

    for (const section of sectionsWithTag) {
      // Delete all items for this section in batches
      let sectionDone = false;
      while (!sectionDone) {
        const items = await ctx.db
          .query("landingPageProductSectionItems")
          .withIndex("by_sectionId", (q) => q.eq("sectionId", section._id))
          .take(64);
        if (items.length === 0) {
          sectionDone = true;
        } else {
          await Promise.all(items.map((item) => ctx.db.delete(item._id)));
        }
      }
      // Clear the tagId from the section
      await ctx.db.patch(section._id, { tagId: undefined });
    }

    await ctx.db.delete(args.id);
    return null;
  },
});

export const toggleActive = mutation({
  args: { id: v.id("tags"), isActive: v.boolean() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.patch(args.id, { isActive: args.isActive });
    return null;
  },
});
