"use client";

import { ShoppingCart } from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { authClient } from "@/lib/auth-client";
import { useCart } from "./CartProvider";

export function CartIcon() {
  const { data: session } = authClient.useSession();
  const { guestItemCount, setIsOpen } = useCart();

  // Only reactive for logged-in users
  const cartItems = useQuery(
    api.cart.get,
    session ? {} : "skip"
  );

  const count = session
    ? (cartItems?.reduce((sum, i) => sum + i.quantity, 0) ?? 0)
    : guestItemCount;

  return (
    <button
      className="relative inline-flex items-center justify-center h-9 w-9 rounded hover:bg-accent transition-colors"
      onClick={() => setIsOpen(true)}
      aria-label="Open cart"
    >
      <ShoppingCart className="h-5 w-5" />
      {count > 0 && (
        <span className="absolute top-0 right-0 h-4 w-4 rounded-full bg-foreground text-background text-[10px] font-medium flex items-center justify-center -translate-y-1/4 translate-x-1/4">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </button>
  );
}
