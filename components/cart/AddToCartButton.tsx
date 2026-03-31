"use client";

import { useState } from "react";
import { Loader2, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { authClient } from "@/lib/auth-client";
import { addToGuestCart } from "@/lib/guest-cart";

interface AddToCartButtonProps {
  productId: Id<"products">;
  variantId: Id<"productVariants"> | null;
  disabled?: boolean;
}

export default function AddToCartButton({
  productId,
  variantId,
  disabled,
}: AddToCartButtonProps) {
  const { data: session } = authClient.useSession();
  const addMutation = useMutation(api.cart.add);
  const [loading, setLoading] = useState(false);

  const isDisabled = disabled || variantId === null;

  async function handleClick() {
    if (isDisabled) return;

    if (session) {
      setLoading(true);
      try {
        await addMutation({ productId, variantId: variantId!, quantity: 1 });
        toast.success("Added to cart");
      } catch {
        toast.error("Failed to add to cart");
      } finally {
        setLoading(false);
      }
    } else {
      addToGuestCart(productId as string, variantId as string, 1);
      toast.success("Added to cart");
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={isDisabled || loading}
      className="w-full h-11 bg-foreground text-background text-xs font-semibold tracking-[0.15em] uppercase hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <ShoppingCart className="h-4 w-4" />
      )}
      Add to Cart
    </button>
  );
}
