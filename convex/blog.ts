import { ConvexError, v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { mutation, query, QueryCtx } from "./_generated/server";
import { requirePermission } from "./lib/auth.helpers";
import { r2 } from "./r2";

const blogStatusValidator = v.union(
  v.literal("draft"),
  v.literal("published"),
);

const saveBlogArgs = {
  title: v.string(),
  slug: v.string(),
  excerpt: v.optional(v.string()),
  contentHtml: v.string(),
  contentJson: v.string(),
  contentText: v.string(),
  status: blogStatusValidator,
  imageStorageId: v.optional(v.string()),
  metaTitle: v.optional(v.string()),
  metaDescription: v.optional(v.string()),
};

function normalizeSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function sanitizeOptionalText(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function deriveExcerpt(excerpt: string | undefined, contentText: string) {
  const cleanedExcerpt = sanitizeOptionalText(excerpt);
  if (cleanedExcerpt) {
    return cleanedExcerpt;
  }

  const compactText = contentText.replace(/\s+/g, " ").trim();
  if (!compactText) {
    return undefined;
  }

  return compactText.length > 180
    ? `${compactText.slice(0, 177).trimEnd()}...`
    : compactText;
}

async function resolveImageUrl(
  storageId: string | undefined,
): Promise<string | null> {
  if (!storageId) {
    return null;
  }

  return await r2.getUrl(storageId);
}

async function serializePostForList(
  ctx: QueryCtx,
  post: {
    _id: Id<"blogPosts">;
    _creationTime: number;
    title: string;
    slug: string;
    excerpt?: string;
    contentText: string;
    status: "draft" | "published";
    authorName?: string;
    imageStorageId?: string;
    publishedAt?: number;
    updatedAt: number;
    metaTitle?: string;
    metaDescription?: string;
  },
) {
  return {
    _id: post._id,
    _creationTime: post._creationTime,
    title: post.title,
    slug: post.slug,
    excerpt: deriveExcerpt(post.excerpt, post.contentText),
    status: post.status,
    authorName: post.authorName,
    imageUrl: await resolveImageUrl(post.imageStorageId),
    publishedAt: post.publishedAt ?? null,
    updatedAt: post.updatedAt,
    metaTitle: post.metaTitle,
    metaDescription: post.metaDescription,
  };
}

async function getExistingBySlug(ctx: QueryCtx, slug: string) {
  return await ctx.db
    .query("blogPosts")
    .withIndex("by_slug", (q) => q.eq("slug", slug))
    .unique();
}

export const checkSlugAvailable = query({
  args: {
    slug: v.string(),
    excludeId: v.optional(v.id("blogPosts")),
  },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "blog");
    const slug = normalizeSlug(args.slug);
    if (!slug) {
      return false;
    }

    const existing = await getExistingBySlug(ctx, slug);
    return !existing || existing._id === args.excludeId;
  },
});

export const listAdmin = query({
  args: {},
  handler: async (ctx) => {
    await requirePermission(ctx, "blog");
    const posts = await ctx.db
      .query("blogPosts")
      .withIndex("by_updatedAt")
      .order("desc")
      .take(200);

    return await Promise.all(posts.map((post) => serializePostForList(ctx, post)));
  },
});

export const getByIdForAdmin = query({
  args: { id: v.id("blogPosts") },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "blog");
    const post = await ctx.db.get(args.id);
    if (!post) {
      return null;
    }

    return {
      ...post,
      excerpt: deriveExcerpt(post.excerpt, post.contentText),
      imageUrl: await resolveImageUrl(post.imageStorageId),
    };
  },
});

export const create = mutation({
  args: saveBlogArgs,
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "blog");
    const slug = normalizeSlug(args.slug);
    if (!slug) {
      throw new ConvexError("Slug is required");
    }

    const title = args.title.trim();
    if (!title) {
      throw new ConvexError("Title is required");
    }

    const existing = await ctx.db
      .query("blogPosts")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    if (existing) {
      throw new ConvexError("Slug already exists");
    }

    const contentHtml = args.contentHtml.trim();
    const contentJson = args.contentJson.trim();
    const contentText = args.contentText.replace(/\s+/g, " ").trim();
    if (!contentHtml || !contentJson || !contentText) {
      throw new ConvexError("Blog content is required");
    }

    const now = Date.now();
    return await ctx.db.insert("blogPosts", {
      title,
      slug,
      excerpt: sanitizeOptionalText(args.excerpt),
      contentHtml,
      contentJson,
      contentText,
      status: args.status,
      authorName:
        sanitizeOptionalText(user.name) ?? sanitizeOptionalText(user.email) ?? "Blackkin",
      authorUserId: user._id,
      imageStorageId: sanitizeOptionalText(args.imageStorageId),
      publishedAt: args.status === "published" ? now : undefined,
      updatedAt: now,
      metaTitle: sanitizeOptionalText(args.metaTitle),
      metaDescription: sanitizeOptionalText(args.metaDescription),
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("blogPosts"),
    ...saveBlogArgs,
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "blog");
    const existing = await ctx.db.get(args.id);
    if (!existing) {
      throw new ConvexError("Blog post not found");
    }

    const slug = normalizeSlug(args.slug);
    if (!slug) {
      throw new ConvexError("Slug is required");
    }

    const collision = await ctx.db
      .query("blogPosts")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    if (collision && collision._id !== args.id) {
      throw new ConvexError("Slug already exists");
    }

    const title = args.title.trim();
    const contentHtml = args.contentHtml.trim();
    const contentJson = args.contentJson.trim();
    const contentText = args.contentText.replace(/\s+/g, " ").trim();
    if (!title || !contentHtml || !contentJson || !contentText) {
      throw new ConvexError("Title and content are required");
    }

    const nextImageStorageId = sanitizeOptionalText(args.imageStorageId);
    const now = Date.now();
    await ctx.db.patch(args.id, {
      title,
      slug,
      excerpt: sanitizeOptionalText(args.excerpt),
      contentHtml,
      contentJson,
      contentText,
      status: args.status,
      authorName:
        sanitizeOptionalText(user.name) ?? existing.authorName ?? sanitizeOptionalText(user.email) ?? "Blackkin",
      authorUserId: user._id,
      imageStorageId: nextImageStorageId,
      publishedAt:
        args.status === "published"
          ? existing.publishedAt ?? now
          : existing.publishedAt,
      updatedAt: now,
      metaTitle: sanitizeOptionalText(args.metaTitle),
      metaDescription: sanitizeOptionalText(args.metaDescription),
    });

    if (
      existing.imageStorageId &&
      existing.imageStorageId !== nextImageStorageId
    ) {
      await r2.deleteObject(ctx, existing.imageStorageId);
    }

    return args.id;
  },
});

export const remove = mutation({
  args: { id: v.id("blogPosts") },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "blog");
    const post = await ctx.db.get(args.id);
    if (!post) {
      return null;
    }

    await ctx.db.delete(args.id);
    if (post.imageStorageId) {
      await r2.deleteObject(ctx, post.imageStorageId);
    }
    return null;
  },
});

export const listPublishedSSR = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(args.limit ?? 24, 1), 100);
    const posts = await ctx.db
      .query("blogPosts")
      .withIndex("by_status_and_publishedAt", (q) => q.eq("status", "published"))
      .order("desc")
      .take(limit);

    const publishedPosts = posts.filter((post) => post.publishedAt !== undefined);
    return await Promise.all(
      publishedPosts.map((post) => serializePostForList(ctx, post)),
    );
  },
});

export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const post = await ctx.db
      .query("blogPosts")
      .withIndex("by_slug", (q) => q.eq("slug", normalizeSlug(args.slug)))
      .unique();

    if (!post || post.status !== "published") {
      return null;
    }

    return {
      _id: post._id,
      _creationTime: post._creationTime,
      title: post.title,
      slug: post.slug,
      excerpt: deriveExcerpt(post.excerpt, post.contentText),
      contentHtml: post.contentHtml,
      contentText: post.contentText,
      authorName: post.authorName,
      imageUrl: await resolveImageUrl(post.imageStorageId),
      publishedAt: post.publishedAt ?? post.updatedAt,
      updatedAt: post.updatedAt,
      metaTitle: post.metaTitle,
      metaDescription: post.metaDescription,
    };
  },
});