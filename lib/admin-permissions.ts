import { redirect } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { fetchAuthQuery } from "@/lib/auth-server";

export type AdminPermission =
  | "orders"
  | "marketing"
  | "products"
  | "settings"
  | "pages"
  | "users"
  | "vouchers"
  | "blog";

type NonOrderAdminPermission = Exclude<AdminPermission, "orders">;

export async function requireAdminPermission(permission: AdminPermission) {
  const user = await fetchAuthQuery(api.users.getCurrentUserWithRole);

  if (!user || (user.role !== "admin" && user.role !== "superadmin")) {
    redirect("/");
  }

  if (user.role === "superadmin") {
    return user;
  }

  if (permission === "orders") {
    if (!user.permissions?.orders?.enabled) {
      redirect("/admin");
    }
    return user;
  }

  const permissions = user.permissions as
    | Record<NonOrderAdminPermission, boolean>
    | undefined;

  if (permissions?.[permission as NonOrderAdminPermission] !== true) {
    redirect("/admin");
  }

  return user;
}