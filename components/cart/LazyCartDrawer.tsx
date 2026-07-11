"use client";

import dynamic from "next/dynamic";
import { useCart } from "@/components/cart/CartProvider";

const CartDrawer = dynamic(
  () => import("@/components/cart/CartDrawer").then((module) => module.CartDrawer),
  { ssr: false },
);

export function LazyCartDrawer() {
  const { isOpen } = useCart();
  return isOpen ? <CartDrawer /> : null;
}
