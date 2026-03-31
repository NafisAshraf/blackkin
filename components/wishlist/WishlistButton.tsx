"use client";

import { useState } from "react";
import { Heart, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { authClient } from "@/lib/auth-client";

interface WishlistButtonProps {
  productId: Id<"products">;
  variant?: "icon" | "full";
}

export default function WishlistButton({
  productId,
  variant = "icon",
}: WishlistButtonProps) {
  const { data: session } = authClient.useSession();
  const inWishlist = useQuery(
    api.wishlist.check,
    session ? { productId } : "skip"
  );
  const toggleMutation = useMutation(api.wishlist.toggle);
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    if (!session) {
      toast.error("Sign in to save to wishlist");
      return;
    }

    setLoading(true);
    try {
      await toggleMutation({ productId });
      toast.success(inWishlist ? "Removed from wishlist" : "Added to wishlist");
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  if (variant === "full") {
    return (
      <button
        onClick={handleClick}
        disabled={loading}
        className="w-full h-11 border border-border bg-background text-foreground text-xs font-semibold tracking-wider uppercase hover:bg-muted transition-colors flex items-center justify-center gap-2 disabled:opacity-40"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Heart
            className="h-4 w-4"
            fill={inWishlist ? "currentColor" : "none"}
          />
        )}
        {inWishlist ? "Saved to Wishlist" : "Save to Wishlist"}
      </button>
    );
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="inline-flex items-center justify-center h-9 w-9 rounded hover:bg-accent transition-colors disabled:opacity-40"
      aria-label={inWishlist ? "Remove from wishlist" : "Add to wishlist"}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Heart
          className="h-5 w-5"
          fill={inWishlist ? "currentColor" : "none"}
        />
      )}
    </button>
  );
}
