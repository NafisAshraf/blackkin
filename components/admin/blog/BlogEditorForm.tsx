"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useUploadFile } from "@convex-dev/r2/react";
import { useMutation, useQuery } from "convex/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Save, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { NovelBlogEditor } from "./NovelBlogEditor";

type BlogStatus = "draft" | "published";

type BlogEditorInitialPost = {
  _id: Id<"blogPosts">;
  title: string;
  slug: string;
  excerpt?: string | null;
  contentJson: string;
  contentHtml: string;
  contentText: string;
  status: BlogStatus;
  imageStorageId?: string | null;
  imageUrl?: string | null;
  publishedAt?: number | null;
  updatedAt: number;
  metaTitle?: string | null;
  metaDescription?: string | null;
};

const EMPTY_EDITOR_DOCUMENT = JSON.stringify({
  type: "doc",
  content: [{ type: "paragraph" }],
});

function toSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function formatDate(value: number | null | undefined) {
  if (!value) {
    return null;
  }

  return new Intl.DateTimeFormat("en-BD", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(value);
}

export function BlogEditorForm({
  mode,
  initialPost,
}: {
  mode: "create" | "edit";
  initialPost?: BlogEditorInitialPost;
}) {
  const router = useRouter();
  const createPost = useMutation(api.blog.create);
  const updatePost = useMutation(api.blog.update);
  const deletePost = useMutation(api.blog.remove);
  const r2Upload = useUploadFile(api.r2);
  const r2Delete = useMutation(api.r2.deleteObject);

  const [title, setTitle] = useState(initialPost?.title ?? "");
  const [slug, setSlug] = useState(initialPost?.slug ?? "");
  const [slugManual, setSlugManual] = useState(mode === "edit");
  const [debouncedSlug, setDebouncedSlug] = useState(initialPost?.slug ?? "");
  const [excerpt, setExcerpt] = useState(initialPost?.excerpt ?? "");
  const [metaTitle, setMetaTitle] = useState(initialPost?.metaTitle ?? "");
  const [metaDescription, setMetaDescription] = useState(
    initialPost?.metaDescription ?? "",
  );
  const [status, setStatus] = useState<BlogStatus>(initialPost?.status ?? "draft");
  const [imageStorageId, setImageStorageId] = useState<string | undefined>(
    initialPost?.imageStorageId ?? undefined,
  );
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(
    initialPost?.imageUrl ?? null,
  );
  const [editorValue, setEditorValue] = useState({
    contentJson: initialPost?.contentJson ?? EMPTY_EDITOR_DOCUMENT,
    contentHtml: initialPost?.contentHtml ?? "",
    contentText: initialPost?.contentText ?? "",
  });
  const [uploadingImage, setUploadingImage] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const previewObjectUrlRef = useRef<string | null>(null);
  const persistedImageStorageIdRef = useRef<string | undefined>(
    initialPost?.imageStorageId ?? undefined,
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSlug(slug.trim());
    }, 350);

    return () => window.clearTimeout(timer);
  }, [slug]);

  useEffect(() => {
    return () => {
      if (previewObjectUrlRef.current) {
        URL.revokeObjectURL(previewObjectUrlRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (slugManual) {
      return;
    }

    setSlug(toSlug(title));
  }, [slugManual, title]);

  const slugAvailable = useQuery(
    api.blog.checkSlugAvailable,
    debouncedSlug
      ? {
          slug: debouncedSlug,
          ...(initialPost?._id ? { excludeId: initialPost._id } : {}),
        }
      : "skip",
  );

  const slugStatus = useMemo(() => {
    if (!debouncedSlug) {
      return null;
    }
    if (slugAvailable === undefined) {
      return "Checking slug...";
    }
    return slugAvailable ? "Slug is available" : "Slug is already in use";
  }, [debouncedSlug, slugAvailable]);

  function releasePreviewObjectUrl() {
    if (previewObjectUrlRef.current) {
      URL.revokeObjectURL(previewObjectUrlRef.current);
      previewObjectUrlRef.current = null;
    }
  }

  async function deleteTemporaryUpload(storageId: string | undefined) {
    if (!storageId || storageId === persistedImageStorageIdRef.current) {
      return;
    }

    try {
      await r2Delete({ key: storageId });
    } catch {
      // Avoid interrupting the main flow for cleanup failures.
    }
  }

  async function handleImageSelection(file: File) {
    setUploadingImage(true);

    try {
      const newStorageId = await r2Upload(file);
      await deleteTemporaryUpload(imageStorageId);
      releasePreviewObjectUrl();

      const objectUrl = URL.createObjectURL(file);
      previewObjectUrlRef.current = objectUrl;
      setImageStorageId(newStorageId);
      setImagePreviewUrl(objectUrl);
      toast.success("Blog image uploaded");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  async function handleRemoveImage() {
    await deleteTemporaryUpload(imageStorageId);
    releasePreviewObjectUrl();
    setImageStorageId(undefined);
    setImagePreviewUrl(null);
  }

  async function handleSave() {
    const normalizedSlug = toSlug(slug || title);
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }

    if (!normalizedSlug) {
      toast.error("Slug is required");
      return;
    }

    if (!editorValue.contentText.trim()) {
      toast.error("Blog content is required");
      return;
    }

    if (slugAvailable === false) {
      toast.error("Choose a different slug");
      return;
    }

    setSaving(true);

    const payload = {
      title: title.trim(),
      slug: normalizedSlug,
      excerpt: excerpt.trim() || undefined,
      contentHtml: editorValue.contentHtml,
      contentJson: editorValue.contentJson,
      contentText: editorValue.contentText,
      status,
      imageStorageId,
      metaTitle: metaTitle.trim() || undefined,
      metaDescription: metaDescription.trim() || undefined,
    };

    try {
      if (mode === "create") {
        const postId = await createPost(payload);
        toast.success(status === "published" ? "Blog published" : "Draft saved");
        router.replace(`/admin/blog/${postId}`);
        return;
      }

      await updatePost({ id: initialPost!._id, ...payload });
      persistedImageStorageIdRef.current = imageStorageId;
      toast.success(status === "published" ? "Blog updated" : "Draft updated");
      router.refresh();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!initialPost?._id || !window.confirm("Delete this blog post?")) {
      return;
    }

    setDeleting(true);
    try {
      await deletePost({ id: initialPost._id });
      toast.success("Blog deleted");
      router.push("/admin/blog");
      router.refresh();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 border-b border-border pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-[0.34em] text-muted-foreground">
            Blog CMS
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            {mode === "create" ? "Write Blog Post" : "Edit Blog Post"}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Keep it simple: strong title, clean slug, one hero image, and readable body copy.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline">
            <Link href="/admin/blog">Back to Posts</Link>
          </Button>
          {mode === "edit" && (
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting || saving}
            >
              {deleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              Delete
            </Button>
          )}
          <Button type="button" onClick={handleSave} disabled={saving || uploadingImage}>
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {status === "published" ? "Save & Publish" : "Save Draft"}
          </Button>
        </div>
      </div>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <section className="space-y-4 rounded-3xl border border-border bg-card p-6 shadow-sm">
            <div className="space-y-1">
              <Label htmlFor="blog-title">Title</Label>
              <Input
                id="blog-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="The post title customers will see"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_180px]">
              <div className="space-y-1">
                <Label htmlFor="blog-slug">Slug</Label>
                <Input
                  id="blog-slug"
                  value={slug}
                  onChange={(event) => {
                    setSlugManual(true);
                    setSlug(toSlug(event.target.value));
                  }}
                  placeholder="blog-post-slug"
                />
                {slugStatus && (
                  <p
                    className={cn(
                      "text-xs",
                      slugAvailable === false
                        ? "text-destructive"
                        : "text-muted-foreground",
                    )}
                  >
                    {slugStatus}
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <Label htmlFor="blog-status">Status</Label>
                <select
                  id="blog-status"
                  value={status}
                  onChange={(event) => setStatus(event.target.value as BlogStatus)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="blog-excerpt">Excerpt</Label>
              <Textarea
                id="blog-excerpt"
                value={excerpt}
                onChange={(event) => setExcerpt(event.target.value)}
                rows={3}
                placeholder="Short summary for cards and previews. Leave blank to auto-generate from the body."
              />
            </div>
          </section>

          <NovelBlogEditor
            initialContent={editorValue.contentJson}
            onChange={setEditorValue}
          />
        </div>

        <div className="space-y-6">
          <section className="space-y-4 rounded-3xl border border-border bg-card p-6 shadow-sm">
            <div>
              <p className="text-sm font-medium">Hero Image</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Optional. Used at the top of the blog page and on the blog cards.
              </p>
            </div>

            {imagePreviewUrl ? (
              <div className="overflow-hidden rounded-2xl border border-border bg-muted/40">
                <img
                  src={imagePreviewUrl}
                  alt={title || "Blog preview"}
                  className="aspect-[16/10] w-full object-cover"
                />
              </div>
            ) : (
              <div className="flex aspect-[16/10] items-center justify-center rounded-2xl border border-dashed border-border bg-muted/20 text-sm text-muted-foreground">
                No image selected
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/avif"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  void handleImageSelection(file);
                }
              }}
            />

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingImage}
              >
                {uploadingImage ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                {imagePreviewUrl ? "Replace Image" : "Upload Image"}
              </Button>
              {imagePreviewUrl && (
                <Button type="button" variant="ghost" onClick={() => void handleRemoveImage()}>
                  <X className="h-4 w-4" />
                  Remove
                </Button>
              )}
            </div>
          </section>

          <section className="space-y-4 rounded-3xl border border-border bg-card p-6 shadow-sm">
            <div>
              <p className="text-sm font-medium">SEO</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Optional overrides. If left empty, the post title and excerpt will be used.
              </p>
            </div>

            <div className="space-y-1">
              <Label htmlFor="blog-meta-title">Meta Title</Label>
              <Input
                id="blog-meta-title"
                value={metaTitle}
                onChange={(event) => setMetaTitle(event.target.value)}
                placeholder="Search result title"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="blog-meta-description">Meta Description</Label>
              <Textarea
                id="blog-meta-description"
                value={metaDescription}
                onChange={(event) => setMetaDescription(event.target.value)}
                rows={4}
                placeholder="Search result description"
              />
            </div>
          </section>

          <section className="space-y-3 rounded-3xl border border-border bg-card p-6 shadow-sm">
            <p className="text-sm font-medium">Post Details</p>
            <div className="space-y-2 text-sm text-muted-foreground">
              {mode === "edit" && (
                <p>
                  Updated {formatDate(initialPost?.updatedAt) ?? "Just now"}
                </p>
              )}
              {initialPost?.publishedAt && (
                <p>Published {formatDate(initialPost.publishedAt)}</p>
              )}
              <p>
                Body length {editorValue.contentText.trim().length.toLocaleString()} characters
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}