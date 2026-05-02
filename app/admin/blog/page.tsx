import Link from "next/link";
import { PenSquare } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { fetchAuthQuery } from "@/lib/auth-server";
import { requireAdminPermission } from "@/lib/admin-permissions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const metadata = { title: "Blog | Admin" };

function formatDate(value: number | null) {
  if (!value) {
    return "Draft";
  }

  return new Intl.DateTimeFormat("en-BD", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(value);
}

export default async function AdminBlogPage() {
  await requireAdminPermission("blog");
  const posts = await fetchAuthQuery(api.blog.listAdmin, {});

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 border-b border-border pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-[0.34em] text-muted-foreground">
            Blog CMS
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Blog Posts</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Write SEO-focused articles, keep drafts private, and manage published posts from one place.
          </p>
        </div>

        <Button asChild>
          <Link href="/admin/blog/new">
            <PenSquare className="h-4 w-4" />
            New Post
          </Link>
        </Button>
      </div>

      {posts.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border bg-muted/20 px-8 py-16 text-center">
          <p className="text-lg font-medium">No blog posts yet</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Create the first article so the footer Blog link has something worth landing on.
          </p>
        </div>
      ) : (
        <div className="grid gap-5 xl:grid-cols-2">
          {posts.map((post) => (
            <Link
              key={post._id}
              href={`/admin/blog/${post._id}`}
              className="group overflow-hidden rounded-3xl border border-border bg-card transition-colors hover:border-foreground/20"
            >
              <div className="grid min-h-full md:grid-cols-[180px_minmax(0,1fr)]">
                <div className="bg-muted/30">
                  {post.imageUrl ? (
                    <img
                      src={post.imageUrl}
                      alt={post.title}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                    />
                  ) : (
                    <div className="flex h-full min-h-[180px] items-center justify-center bg-muted/40 text-xs uppercase tracking-[0.3em] text-muted-foreground">
                      No Image
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-4 p-6">
                  <div className="flex items-center justify-between gap-3">
                    <Badge variant={post.status === "published" ? "default" : "secondary"}>
                      {post.status}
                    </Badge>
                    <span className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                      {formatDate(post.publishedAt)}
                    </span>
                  </div>

                  <div className="space-y-2">
                    <h2 className="text-xl font-semibold tracking-tight">{post.title}</h2>
                    <p className="line-clamp-3 text-sm leading-6 text-muted-foreground">
                      {post.excerpt ?? "No excerpt yet."}
                    </p>
                  </div>

                  <div className="mt-auto flex items-center justify-between gap-3 text-xs uppercase tracking-[0.24em] text-muted-foreground">
                    <span>{post.authorName ?? "Blackkin"}</span>
                    <span>Edit Post</span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}