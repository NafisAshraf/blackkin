import { requireAdminPermission } from "@/lib/admin-permissions";
import { BlogEditorForm } from "@/components/admin/blog/BlogEditorForm";

export const metadata = { title: "New Blog Post | Admin" };

export default async function NewBlogPostPage() {
  await requireAdminPermission("blog");

  return <BlogEditorForm mode="create" />;
}