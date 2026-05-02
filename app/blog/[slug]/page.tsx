import { cache } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import { fetchAuthQuery } from "@/lib/auth-server";

interface PageProps {
  params: Promise<{ slug: string }>;
}

const getBlogPost = cache(async (slug: string) => {
  return await fetchAuthQuery(api.blog.getBySlug, { slug });
});

function formatDate(value: number) {
  return new Intl.DateTimeFormat("en-BD", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(value);
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  const post = await getBlogPost(slug);

  if (!post) {
    return {
      title: "Blog | Blackkin",
      description: "Insights and stories from Blackkin.",
    };
  }

  return {
    title: `${post.metaTitle ?? post.title} | Blackkin`,
    description:
      post.metaDescription ??
      post.excerpt ??
      "Insights and stories from Blackkin.",
  };
}

export const dynamic = "force-dynamic";

export default async function BlogDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const post = await getBlogPost(slug);

  if (!post) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />

      <main className="pb-16">
        <section className="px-6 pb-12 pt-10 lg:px-10 lg:pt-14">
          <div className="mx-auto max-w-5xl">
            <Link
              href="/blog"
              className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.28em] text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to blog
            </Link>

            {post.imageUrl && (
              <div className="mt-8 overflow-hidden rounded-[2rem] border border-border bg-muted/30 shadow-sm">
                <img
                  src={post.imageUrl}
                  alt={post.title}
                  className="aspect-[16/8] w-full object-cover"
                />
              </div>
            )}

            <div className="mx-auto max-w-3xl pt-8 lg:pt-10">
              <div className="space-y-5 border-b border-border pb-8">
                <p className="text-[11px] uppercase tracking-[0.34em] text-muted-foreground">
                  {post.authorName ?? "Blackkin"} • {formatDate(post.publishedAt)}
                </p>
                <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
                  {post.title}
                </h1>
                {post.excerpt && (
                  <p className="text-lg leading-8 text-muted-foreground">
                    {post.excerpt}
                  </p>
                )}
              </div>

              <article
                className="blog-richtext pt-8 text-[17px]"
                dangerouslySetInnerHTML={{ __html: post.contentHtml }}
              />
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}