"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Package,
  Tag,
  FolderOpen,
  ShoppingCart,
  Users,
  Megaphone,
  Star,
  Ruler,
  Sparkles,
} from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
    ],
  },
  {
    label: "Catalog",
    items: [
      { href: "/admin/products", label: "Products", icon: Package },
      { href: "/admin/categories", label: "Categories", icon: FolderOpen },
      { href: "/admin/tags", label: "Tags", icon: Tag },
      { href: "/admin/sizes", label: "Sizes & Colors", icon: Ruler },
    ],
  },
  {
    label: "Sales",
    items: [
      { href: "/admin/orders", label: "Orders", icon: ShoppingCart },
      { href: "/admin/campaigns", label: "Campaigns", icon: Megaphone },
      { href: "/admin/customers", label: "Customers", icon: Users },
    ],
  },
  {
    label: "Content",
    items: [
      { href: "/admin/recommendations", label: "Recommendations", icon: Sparkles },
      { href: "/admin/reviews", label: "Reviews", icon: Star },
    ],
  },
];

interface AdminSidebarProps {
  onClose?: () => void;
}

export function AdminSidebar({ onClose }: AdminSidebarProps) {
  const pathname = usePathname();

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

      {/* Navigation groups */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
        {navGroups.map((group) => (
          <div key={group.label}>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.15em] px-3 mb-2">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
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
                        : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
                    )}
                  >
                    <item.icon className="h-4 w-4 flex-shrink-0" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
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
