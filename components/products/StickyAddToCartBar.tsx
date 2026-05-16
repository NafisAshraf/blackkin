"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { authClient } from "@/lib/auth-client";
import { useCart } from "@/components/cart/CartProvider";
import { getGuestCart } from "@/lib/guest-cart";
import AddToCartButton from "@/components/cart/AddToCartButton";
import { cn } from "@/lib/utils";

interface Variant {
  _id: Id<"productVariants">;
  size: string;
  color?: string;
  stock: number;
}

interface StickyAddToCartBarProps {
  product: {
    _id: Id<"products">;
    name: string;
    effectivePrice: number;
    variants: Variant[];
  };
  thumbnailUrl: string | null;
  selectedColor: string | null;
  selectedSize: string | null;
  visible: boolean;
  onScrollToOptions?: () => void;
}

export default function StickyAddToCartBar({
  product,
  thumbnailUrl,
  selectedColor,
  selectedSize,
  visible,
  onScrollToOptions,
}: StickyAddToCartBarProps) {
  const { data: session } = authClient.useSession();
  const { guestItemCount } = useCart();

  const cartWithPricing = useQuery(
    api.cart.getCartWithPricing,
    session ? {} : "skip",
  );

  // Resolve selected variant — matches ProductInfo logic
  const variantsForSize = selectedSize
    ? product.variants.filter((v) => v.size === selectedSize)
    : [];
  const hasColorVariants = product.variants.some((v) => !!v.color);

  const selectedVariant =
    selectedSize && !hasColorVariants
      ? (variantsForSize[0] ?? null)
      : selectedSize && selectedColor
        ? (variantsForSize.find((v) => v.color === selectedColor) ?? null)
        : null;

  const selectedVariantId = selectedVariant?._id ?? null;

  // Auth cart check
  const authCartItem =
    selectedVariantId && cartWithPricing
      ? cartWithPricing.items.find((i) => i.variantId === selectedVariantId)
      : null;

  // Guest cart check — reacts to guestItemCount so it updates after adds/removes
  const [guestInCart, setGuestInCart] = useState(false);
  useEffect(() => {
    if (session || !selectedVariantId) {
      setGuestInCart(false);
      return;
    }
    const items = getGuestCart();
    setGuestInCart(
      items.some((i) => i.variantId === (selectedVariantId as string)),
    );
  }, [guestItemCount, selectedVariantId, session]);

  const isInCart = !!authCartItem || guestInCart;
  const outOfStock = selectedVariant !== null && selectedVariant.stock === 0;
  const needsSelection = !selectedVariantId;

  // Show selection info under name
  const selectionLabel = [selectedColor, selectedSize]
    .filter(Boolean)
    .join(" / ");

  return (
    <div
      className={cn(
        "fixed bottom-0 inset-x-0 z-50 bg-background/95 backdrop-blur-sm border-t border-border shadow-[0_-2px_20px_rgba(0,0,0,0.07)] transition-transform duration-300 ease-out",
        visible ? "translate-y-0" : "translate-y-full",
      )}
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-hidden={!visible}
    >
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-10 py-3 flex items-center gap-3 sm:gap-4">
        {/* Thumbnail */}
        <div className="w-10 h-10 sm:w-12 sm:h-12 flex-shrink-0 overflow-hidden bg-muted">
          {thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={thumbnailUrl}
              alt={product.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-muted" />
          )}
        </div>

        {/* Name + selection */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium leading-tight line-clamp-1">
            {product.name}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs font-semibold">
              ৳{product.effectivePrice.toLocaleString()}
            </span>
            {selectionLabel && (
              <>
                <span className="text-muted-foreground text-xs">·</span>
                <span className="text-xs text-muted-foreground capitalize">
                  {selectionLabel}
                </span>
              </>
            )}
          </div>
        </div>

        {/* CTA */}
        <div className="flex-shrink-0 w-36 sm:w-40">
          {needsSelection ? (
            <button
              type="button"
              onClick={onScrollToOptions}
              className="w-full h-10 border border-border text-foreground text-[11px] font-semibold tracking-wider uppercase flex items-center justify-center hover:bg-muted transition-colors"
            >
              Select Options
            </button>
          ) : outOfStock ? (
            <button
              disabled
              className="w-full h-10 bg-muted text-muted-foreground text-[11px] font-semibold tracking-wider uppercase flex items-center justify-center cursor-not-allowed"
            >
              Out of Stock
            </button>
          ) : isInCart ? (
            <Link
              href="/checkout"
              className="w-full h-10 bg-foreground text-background text-[11px] font-semibold tracking-wider uppercase flex items-center justify-center gap-1.5 hover:opacity-90 transition-opacity"
            >
              <ShoppingBag className="h-3.5 w-3.5" />
              Checkout
            </Link>
          ) : (
            <AddToCartButton
              productId={product._id}
              variantId={selectedVariantId}
              disabled={!selectedVariantId}
              quantity={1}
              className="h-10 tracking-wider"
            />
          )}
        </div>
      </div>
    </div>
  );
}
