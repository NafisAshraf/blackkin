"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Users,
  Megaphone,
  Settings,
  UserCog,
  Layout,
  TicketPercent,
} from "lucide-react";

export interface SidebarUser {
  role: "customer" | "admin" | "superadmin";
  permissions?: {
    orders?: {
      enabled: boolean;
      allowedStatuses: string[];
      canEdit: boolean;
      canDelete: boolean;
      canConfirm: boolean;
    };
    marketing: boolean;
    products: boolean;
    settings: boolean;
    pages: boolean;
    users: boolean;
    vouchers: boolean;
  };
}

type NonOrderPermission = Exclude<
  keyof NonNullable<SidebarUser["permissions"]>,
  "orders"
>;

function hasPermission(
  user: SidebarUser,
  permission: "orders" | NonOrderPermission,
): boolean {
  if (user.role === "superadmin") return true;
  if (permission === "orders") {
    return user.permissions?.orders?.enabled === true;
  }
  return user.permissions?.[permission as NonOrderPermission] === true;
}

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
}

function buildNavItems(user: SidebarUser): NavItem[] {
  const items: NavItem[] = [];

  // Dashboard — always visible
  items.push({
    href: "/admin",
    label: "Dashboard",
    icon: LayoutDashboard,
    exact: true,
  });

  // Products (includes categories, tags, discounts, recommendations as tabs)
  if (hasPermission(user, "products")) {
    items.push({ href: "/admin/products", label: "Products", icon: Package });
  }

  // Vouchers — own permission
  if (hasPermission(user, "vouchers")) {
    items.push({
      href: "/admin/vouchers",
      label: "Vouchers",
      icon: TicketPercent,
    });
  }

  // Orders
  if (hasPermission(user, "orders")) {
    items.push({ href: "/admin/orders", label: "Orders", icon: ShoppingCart });
  }

  // Customers (includes Reviews as a tab)
  if (hasPermission(user, "users")) {
    items.push({ href: "/admin/customers", label: "Customers", icon: Users });
  }

  // Marketing hub
  if (hasPermission(user, "marketing")) {
    items.push({
      href: "/admin/marketing",
      label: "Marketing",
      icon: Megaphone,
    });
  }

  // Landing Page
  if (hasPermission(user, "pages")) {
    items.push({
      href: "/admin/landing-page",
      label: "Landing Page",
      icon: Layout,
    });
  }

  // Settings (sizes, colors, platform config)
  if (hasPermission(user, "settings")) {
    items.push({ href: "/admin/settings", label: "Settings", icon: Settings });
  }

  // Employees — superadmin only
  if (user.role === "superadmin") {
    items.push({ href: "/admin/employees", label: "Employees", icon: UserCog });
  }

  return items;
}

interface AdminSidebarProps {
  user: SidebarUser;
  onClose?: () => void;
}

export function AdminSidebar({ user, onClose }: AdminSidebarProps) {
  const pathname = usePathname();
  const navItems = buildNavItems(user);

  return (
    <aside className="w-56 flex-shrink-0 flex flex-col bg-background border-r border-border min-h-full">
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-border">
        <Link
          href="/"
          className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          onClick={onClose}
        >
          <img src="/logo.svg" alt="Blackkin" className="h-7 w-auto" />
          <span className="text-sm font-bold tracking-wider uppercase">
            Blackkin
          </span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
        {navItems.map((item) => {
          const isActive = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={cn(
                "flex items-center gap-3 px-3 py-2 text-sm transition-colors rounded",
                isActive
                  ? "bg-foreground text-background font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/60",
              )}
            >
              <item.icon className="h-4 w-4 flex-shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Back to store link */}
      <div className="px-3 py-4 border-t border-border">
        <Link
          href="/"
          onClick={onClose}
          className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Back to Store
        </Link>
      </div>
    </aside>
  );
}
