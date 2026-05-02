import { notFound } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { BlogEditorForm } from "@/components/admin/blog/BlogEditorForm";
import { fetchAuthQuery } from "@/lib/auth-server";
import { requireAdminPermission } from "@/lib/admin-permissions";

interface PageProps {
  params: Promise<{ postId: string }>;
}

export const metadata = { title: "Edit Blog Post | Admin" };

export default async function EditBlogPostPage({ params }: PageProps) {
  await requireAdminPermission("blog");
  const { postId } = await params;

  const post = await fetchAuthQuery(api.blog.getByIdForAdmin, {
    id: postId as Id<"blogPosts">,
  });

  if (!post) {
    notFound();
  }

  return <BlogEditorForm mode="edit" initialPost={post} />;
}