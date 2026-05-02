import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import { fetchAuthQuery } from "@/lib/auth-server";

export const metadata = {
  title: "Blog | Blackkin",
  description:
    "Comfort, care, and product insights from Blackkin. Explore articles built for customers and search visibility.",
};

export const dynamic = "force-dynamic";

function formatDate(value: number | null) {
  if (!value) {
    return "Coming soon";
  }

  return new Intl.DateTimeFormat("en-BD", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(value);
}

export default async function BlogPage() {
  const posts = await fetchAuthQuery(api.blog.listPublishedSSR, { limit: 48 });
  const [featuredPost, ...remainingPosts] = posts;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />

      <main>
        <section className="border-b border-border bg-[linear-gradient(180deg,rgba(0,0,0,0.06),transparent)] px-6 py-16 lg:px-10 lg:py-24">
          <div className="mx-auto max-w-6xl">
            <p className="text-[11px] uppercase tracking-[0.38em] text-muted-foreground">
              Blackkin Journal
            </p>
            <div className="mt-5 grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-end">
              <div>
                <h1 className="max-w-4xl text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
                  Blog stories built for discovery, comfort, and better buying decisions.
                </h1>
                <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
                  Short, useful writing from Blackkin on fit, care, materials, and the details customers search before they buy.
                </p>
              </div>
              <div className="rounded-3xl border border-border bg-card/70 p-6 backdrop-blur">
                <p className="text-[11px] uppercase tracking-[0.32em] text-muted-foreground">
                  Published posts
                </p>
                <p className="mt-3 text-5xl font-semibold tracking-tight">
                  {posts.length}
                </p>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  A simple editorial index designed for SEO and a clean reading experience.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="px-6 py-10 lg:px-10 lg:py-14">
          <div className="mx-auto max-w-6xl">
            {featuredPost ? (
              <Link
                href={`/blog/${featuredPost.slug}`}
                className="group grid overflow-hidden rounded-[2rem] border border-border bg-card shadow-sm transition-colors hover:border-foreground/20 lg:grid-cols-[1.2fr_minmax(0,1fr)]"
              >
                <div className="bg-muted/30">
                  {featuredPost.imageUrl ? (
                    <img
                      src={featuredPost.imageUrl}
                      alt={featuredPost.title}
                      className="aspect-[16/10] h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                    />
                  ) : (
                    <div className="flex aspect-[16/10] h-full items-center justify-center bg-[radial-gradient(circle_at_top_left,rgba(0,0,0,0.12),transparent_55%),linear-gradient(135deg,rgba(0,0,0,0.05),transparent)] text-[11px] uppercase tracking-[0.34em] text-muted-foreground">
                      Featured Post
                    </div>
                  )}
                </div>

                <div className="flex flex-col justify-between gap-6 p-8 lg:p-10">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.34em] text-muted-foreground">
                      Featured article
                    </p>
                    <h2 className="mt-4 text-3xl font-semibold tracking-tight lg:text-4xl">
                      {featuredPost.title}
                    </h2>
                    <p className="mt-4 max-w-xl text-base leading-7 text-muted-foreground">
                      {featuredPost.excerpt}
                    </p>
                  </div>

                  <div className="flex items-center justify-between gap-4 text-sm text-muted-foreground">
                    <div>
                      <p>{featuredPost.authorName ?? "Blackkin"}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.24em]">
                        {formatDate(featuredPost.publishedAt)}
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.26em] text-foreground">
                      Read article
                      <ArrowRight className="h-4 w-4" />
                    </span>
                  </div>
                </div>
              </Link>
            ) : (
              <div className="rounded-[2rem] border border-dashed border-border bg-muted/20 px-8 py-20 text-center">
                <p className="text-lg font-medium">No published posts yet</p>
                <p className="mt-3 text-sm text-muted-foreground">
                  Publish a blog post from the admin panel and it will appear here automatically.
                </p>
              </div>
            )}

            {remainingPosts.length > 0 && (
              <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                {remainingPosts.map((post) => (
                  <Link
                    key={post._id}
                    href={`/blog/${post.slug}`}
                    className="group overflow-hidden rounded-[1.75rem] border border-border bg-card shadow-sm transition-colors hover:border-foreground/20"
                  >
                    <div className="bg-muted/30">
                      {post.imageUrl ? (
                        <img
                          src={post.imageUrl}
                          alt={post.title}
                          className="aspect-[16/10] w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                        />
                      ) : (
                        <div className="flex aspect-[16/10] items-center justify-center bg-[linear-gradient(135deg,rgba(0,0,0,0.08),transparent)] text-[11px] uppercase tracking-[0.34em] text-muted-foreground">
                          Blackkin Blog
                        </div>
                      )}
                    </div>

                    <div className="space-y-4 p-6">
                      <div className="flex items-center justify-between gap-3 text-[11px] uppercase tracking-[0.26em] text-muted-foreground">
                        <span>{post.authorName ?? "Blackkin"}</span>
                        <span>{formatDate(post.publishedAt)}</span>
                      </div>

                      <div>
                        <h3 className="text-xl font-semibold tracking-tight">{post.title}</h3>
                        <p className="mt-3 line-clamp-3 text-sm leading-6 text-muted-foreground">
                          {post.excerpt}
                        </p>
                      </div>

                      <span className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.26em] text-foreground">
                        Read more
                        <ArrowRight className="h-4 w-4" />
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}