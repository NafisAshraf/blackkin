"use client";

import { useState } from "react";
import { Heart, Loader2, ShoppingCart, Info, Trash2 } from "lucide-react";
import SizeSelector from "./SizeSelector";
import AddToCartButton from "@/components/cart/AddToCartButton";
import WishlistButton from "@/components/wishlist/WishlistButton";
import { Id } from "@/convex/_generated/dataModel";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { addToGuestCart, getGuestCart, updateGuestCartQuantity, removeFromGuestCart } from "@/lib/guest-cart";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Variant {
  _id: Id<"productVariants">;
  size: string;
  color?: string;
  stock: number;
  priceOverride?: number;
}

interface Tag {
  _id: string;
  name: string;
  slug: string;
}

interface PlatformSize {
  name: string;
  measurements?: string;
}

interface ProductInfoProps {
  product: {
    _id: Id<"products">;
    name: string;
    basePrice: number;
    effectivePrice: number;
    discountAmount: number;
    discountGroupName: string | null;
    averageRating: number;
    totalRatings: number;
    variants: Variant[];
    tags: Tag[];
  };
  platformSizes: PlatformSize[];
}


function StarRating({ rating, count }: { rating: number; count: number }) {
  return (
    <div className="flex items-center gap-1 text-sm">
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className={i <= Math.round(rating) ? "text-yellow-400" : "text-muted-foreground/30"}
        >
          &#9733;
        </span>
      ))}
      <span className="text-muted-foreground text-xs ml-1">({count} reviews)</span>
    </div>
  );
}

export default function ProductInfo({ product, platformSizes }: ProductInfoProps) {
  const platformColors = useQuery(api.platformConfig.listColors);
  const colorHexMap = platformColors
    ? Object.fromEntries(platformColors.map((c) => [c.name.toLowerCase(), c.hexCode]))
    : {};

  function getColorHex(colorName?: string): string {
    if (!colorName) return "#cccccc";
    return colorHexMap[colorName.toLowerCase()] ?? "#cccccc";
  }

  const {
    _id,
    name,
    basePrice,
    effectivePrice,
    discountAmount,
    discountGroupName,
    averageRating,
    totalRatings,
    variants,
    tags,
  } = product;

  const { data: session } = authClient.useSession();

  // Pre-select first available variant
  const initialVariant = variants.find((v) => v.stock > 0) || variants[0];

  const [selectedSize, setSelectedSize] = useState<string | null>(
    initialVariant?.size || null
  );
  const [selectedColor, setSelectedColor] = useState<string | null>(
    initialVariant?.color || null
  );
  // Cart data and mutations
  const cartWithPricing = useQuery(api.cart.getCartWithPricing, session ? {} : "skip");
  const updateCartQty = useMutation(api.cart.updateQuantity);
  const removeFromCartMutation = useMutation(api.cart.remove);

  const [quantity, setQuantity] = useState(1);
  const [isUpdatingCart, setIsUpdatingCart] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const uniqueSizes = Array.from(new Set(variants.map((v) => v.size)));

  const sizesWithStock = uniqueSizes.map((sizeName) => {
    const platform = platformSizes.find((ps) => ps.name === sizeName);
    const hasStock = variants.some((v) => v.size === sizeName && v.stock > 0);
    return {
      name: sizeName,
      measurements: platform?.measurements,
      inStock: hasStock,
    };
  });

  const variantsForSize = selectedSize
    ? variants.filter((v) => v.size === selectedSize)
    : [];

  const uniqueColors = Array.from(
    new Set(variantsForSize.map((v) => v.color).filter((c): c is string => !!c))
  );

  // Also get all colors across all sizes for the color picker
  const allColors = Array.from(
    new Set(variants.map((v) => v.color).filter((c): c is string => !!c))
  );

  const selectedVariant =
    selectedSize && uniqueColors.length === 0
      ? variantsForSize[0] ?? null
      : selectedSize && selectedColor
      ? variantsForSize.find((v) => v.color === selectedColor) ?? null
      : null;

  const selectedVariantId = selectedVariant?._id ?? null;
  const isDiscounted = discountAmount > 0;
  const discountPct = isDiscounted
    ? Math.round((discountAmount / basePrice) * 100)
    : 0;

  // Check if selected variant is in cart
  const cartItem = selectedVariantId && cartWithPricing
    ? cartWithPricing.items.find((i) => i.variantId === selectedVariantId)
    : null;
  
  const isInCart = !!cartItem;

  // If in cart, local quantity should match cart quantity (if not currently being edited)
  const displayQuantity = isInCart ? cartItem.quantity : quantity;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold leading-tight">{name}</h1>
        {totalRatings > 0 && (
          <div className="mt-1.5">
            <StarRating rating={averageRating} count={totalRatings} />
          </div>
        )}
      </div>

      {/* Price */}
      <div className="flex items-baseline gap-3">
        <span className="text-2xl font-bold">
          ৳{effectivePrice.toLocaleString()}
        </span>
        {isDiscounted && (
          <>
            <span className="text-sm text-muted-foreground line-through">
              ৳{basePrice.toLocaleString()}
            </span>
            <span className="text-xs font-semibold text-red-600 bg-red-50 px-2 py-0.5">
              -{discountPct}%
            </span>
          </>
        )}
      </div>
      {discountGroupName && (
        <p className="text-xs text-muted-foreground -mt-3">{discountGroupName}</p>
      )}

      {/* Color selector */}
      {allColors.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium">
            Color:{" "}
            <span className="font-normal text-muted-foreground">
              {selectedColor ?? "Select color"}
            </span>
          </p>
          <div className="flex flex-wrap gap-2">
            {allColors.map((color) => {
              const hex = getColorHex(color);
              const isSelected = selectedColor === color;
              return (
                <button
                  key={color}
                  type="button"
                  onClick={() => {
                    setSelectedColor(color);
                  }}
                  className={`h-7 w-7 rounded-full transition-all ${
                    isSelected
                      ? "border-2 border-foreground scale-110"
                      : "border border-gray-300 hover:border-gray-400 hover:scale-105"
                  }`}
                  style={{
                    backgroundColor: hex,
                  }}
                  title={color}
                  aria-label={color}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Size selector */}
      {sizesWithStock.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Size</p>
            <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
              <Info className="h-3 w-3" />
              Size guide
            </button>
          </div>
          {/* Show measurement hint if available */}
          {selectedSize && (
            <p className="text-xs text-muted-foreground">
              {platformSizes.find((ps) => ps.name === selectedSize)?.measurements}
            </p>
          )}
          <SizeSelector
            sizes={sizesWithStock}
            selectedSize={selectedSize}
            onChange={(size) => {
              setSelectedSize(size);
              // Color reconciliation for the new size
              const variantsForNewSize = variants.filter((v) => v.size === size);
              const isColorStillValid = variantsForNewSize.some(
                (v) => v.color === selectedColor && v.stock > 0
              );

              if (!isColorStillValid) {
                const firstInStock = variantsForNewSize.find((v) => v.stock > 0);
                if (firstInStock) {
                  setSelectedColor(firstInStock.color || null);
                } else {
                  setSelectedColor(variantsForNewSize[0]?.color || null);
                }
              }
            }}
          />
        </div>
      )}

      {/* Quantity & Actions */}
      <div className="space-y-4 pt-1">
        <p className="text-sm font-medium">Quantity</p>
        <div className="flex gap-4 items-stretch">
          <div className="flex items-center gap-0 border border-border w-fit shrink-0">
            {isInCart && cartItem!.quantity === 1 ? (
              <button
                type="button"
                className="h-11 w-11 flex items-center justify-center hover:bg-muted transition-colors disabled:opacity-40"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={isUpdatingCart}
                aria-label="Remove from cart"
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </button>
            ) : (
              <button
                type="button"
                className="h-11 w-11 flex items-center justify-center hover:bg-muted transition-colors text-lg disabled:opacity-40"
                onClick={async () => {
                  if (isInCart) {
                    setIsUpdatingCart(true);
                    await updateCartQty({ cartItemId: cartItem!._id, quantity: cartItem!.quantity - 1 });
                    setIsUpdatingCart(false);
                  } else {
                    setQuantity((q) => Math.max(1, q - 1));
                  }
                }}
                disabled={(isInCart ? (cartItem?.quantity ?? 1) <= 1 : quantity <= 1) || isUpdatingCart}
              >
                −
              </button>
            )}
            <span className="h-11 w-12 flex items-center justify-center text-sm font-medium border-x border-border">
              {isUpdatingCart ? <Loader2 className="h-3 w-3 animate-spin" /> : displayQuantity}
            </span>
            <button
              type="button"
              className="h-11 w-11 flex items-center justify-center hover:bg-muted transition-colors text-lg disabled:opacity-40"
              onClick={async () => {
                if (isInCart) {
                  setIsUpdatingCart(true);
                  await updateCartQty({ cartItemId: cartItem._id, quantity: cartItem.quantity + 1 });
                  setIsUpdatingCart(false);
                } else {
                  setQuantity((q) => q + 1);
                }
              }}
              disabled={
                (selectedVariant ? displayQuantity >= selectedVariant.stock : false) || isUpdatingCart
              }
            >
              +
            </button>
          </div>
          
          <div className="flex-1 w-full min-w-0">
            {!isInCart ? (
              <AddToCartButton
                productId={_id}
                variantId={selectedVariantId}
                disabled={!selectedVariantId}
                quantity={quantity}
                onSuccess={() => setQuantity(1)}
              />
            ) : (
              <div className="flex flex-col gap-2 h-full">
                <button
                  className="w-full h-11 bg-muted text-muted-foreground text-xs font-semibold tracking-wider uppercase cursor-default flex items-center justify-center gap-2"
                  disabled
                >
                  <ShoppingCart className="h-4 w-4" />
                  In Cart
                </button>
                <p className="text-[10px] text-center text-muted-foreground uppercase tracking-wider line-clamp-1">
                  Item already in cart. Use quantity selector to adjust.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Save to Wishlist */}
        <div className="flex justify-center mt-2">
          <WishlistButton productId={_id} variant="full" />
        </div>
      </div>

      {/* Tags */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {tags.map((tag) => (
            <span
              key={tag._id}
              className="text-[10px] tracking-wider uppercase text-muted-foreground border border-border px-2 py-0.5"
            >
              {tag.name}
            </span>
          ))}
        </div>
      )}

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove from cart?</AlertDialogTitle>
            <AlertDialogDescription>
              Remove &ldquo;{name}&rdquo; from your cart?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isUpdatingCart}
              onClick={async () => {
                if (cartItem) {
                  setIsUpdatingCart(true);
                  await removeFromCartMutation({ cartItemId: cartItem._id });
                  setIsUpdatingCart(false);
                }
                setShowDeleteConfirm(false);
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
