import { redirect } from "next/navigation";
import { fetchAuthQuery, isAuthenticated } from "@/lib/auth-server";
import { api } from "@/convex/_generated/api";
import { AdminLayoutClient } from "@/components/admin/AdminLayoutClient";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const authed = await isAuthenticated();
  if (!authed) {
    redirect("/login?next=/admin");
  }

  const user = await fetchAuthQuery(api.users.getCurrentUserWithRole);
  if (!user || !["admin", "superadmin"].includes(user.role)) {
    redirect("/");
  }

  return (
    <AdminLayoutClient user={{ role: user.role, permissions: user.permissions }}>
      {children}
    </AdminLayoutClient>
  );
}
