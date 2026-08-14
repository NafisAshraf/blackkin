"use client";

import { useState, useEffect, useRef } from "react";
import {
  Loader2,
  ShoppingCart,
  Info,
  Trash2,
  ShoppingBag,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import SizeSelector from "./SizeSelector";
import AddToCartButton from "@/components/cart/AddToCartButton";
import { useCart } from "@/components/cart/CartProvider";
import WishlistButton from "@/components/wishlist/WishlistButton";
import { Id } from "@/convex/_generated/dataModel";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { getGuestCart } from "@/lib/guest-cart";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useMetaTracking } from "@/hooks/use-meta-tracking";
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

interface PlatformColor {
  name: string;
  hexCode: string;
}

interface ProductInfoProps {
  product: {
    _id: Id<"products">;
    name: string;
    basePrice: number;
    effectivePrice: number;
    discountAmount: number;
    discountGroupName: string | null;
    discountEndTime?: number | null;
    averageRating: number;
    totalRatings: number;
    variants: Variant[];
    tags: Tag[];
  };
  platformSizes: PlatformSize[];
  platformColors: PlatformColor[];
  /** Controlled color — when provided, overrides internal state */
  selectedColor?: string | null;
  /** Called when the user picks a color — required when selectedColor is provided */
  onColorChange?: (
    color: string,
    options?: { jumpToMedia?: boolean },
  ) => void;
  /** Controlled size — when provided, overrides internal state */
  selectedSize?: string | null;
  /** Called when the user picks a size */
  onSizeChange?: (size: string) => void;
  /** Ref attached to the Quantity + Add to Cart section (used for sticky bar visibility) */
  addToCartRef?: React.RefObject<HTMLDivElement | null>;
}

function SaleCountdownTimer({ endTime }: { endTime: number }) {
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    function compute() {
      const remaining = endTime - Date.now();
      if (remaining <= 0) {
        setLabel(null);
        return;
      }
      const totalSecs = Math.floor(remaining / 1000);
      const days = Math.floor(totalSecs / 86400);
      const hours = Math.floor((totalSecs % 86400) / 3600);
      const mins = Math.floor((totalSecs % 3600) / 60);
      const secs = totalSecs % 60;
      if (days > 0) {
        setLabel(`${days}d ${hours}h ${mins}m`);
      } else {
        const hh = String(hours).padStart(2, "0");
        const mm = String(mins).padStart(2, "0");
        const ss = String(secs).padStart(2, "0");
        setLabel(`${hh}:${mm}:${ss}`);
      }
    }
    compute();
    const id = setInterval(compute, 1000);
    return () => clearInterval(id);
  }, [endTime]);

  if (!label) return null;

  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600">
      ⏱ Sale ends in {label}
    </span>
  );
}

function StarRating({ rating, count }: { rating: number; count: number }) {
  return (
    <div className="flex items-center gap-1 text-sm">
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className={
            i <= Math.round(rating)
              ? "text-yellow-400"
              : "text-muted-foreground/30"
          }
        >
          &#9733;
        </span>
      ))}
      <span className="text-muted-foreground text-xs ml-1">
        ({count} reviews)
      </span>
    </div>
  );
}

export default function ProductInfo({
  product,
  platformSizes,
  platformColors,
  selectedColor: controlledColor,
  onColorChange,
  selectedSize: controlledSize,
  onSizeChange,
  addToCartRef,
}: ProductInfoProps) {
  const router = useRouter();
  const colorHexMap = Object.fromEntries(
    platformColors.map((color) => [
      color.name.toLowerCase(),
      color.hexCode,
    ]),
  );

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
    discountEndTime,
    averageRating,
    totalRatings,
    variants,
    tags,
  } = product;

  const { data: session } = authClient.useSession();
  const {
    cartItems,
    addGuestItem,
    guestItemCount,
    removeGuestItem,
    updateGuestQuantity,
  } = useCart();

  // Pre-select first available variant
  const initialVariant = variants.find((v) => v.stock > 0) || variants[0];

  const [internalSize, setInternalSize] = useState<string | null>(
    initialVariant?.size || null,
  );
  // Use controlled size if provided, otherwise fall back to internal state
  const selectedSize =
    controlledSize !== undefined ? controlledSize : internalSize;
  function setSelectedSize(size: string | null) {
    setInternalSize(size);
    if (size && onSizeChange) onSizeChange(size);
  }
  const [internalColor, setInternalColor] = useState<string | null>(
    initialVariant?.color || null,
  );
  // Use controlled color if provided, otherwise fall back to internal state
  const selectedColor =
    controlledColor !== undefined ? controlledColor : internalColor;
  function setSelectedColor(
    color: string | null,
    options?: { jumpToMedia?: boolean },
  ) {
    setInternalColor(color);
    if (color && onColorChange) onColorChange(color, options);
  }
  // Cart mutations share the single cart subscription owned by CartProvider.
  const updateCartQty = useMutation(api.cart.updateQuantity);
  const removeFromCartMutation = useMutation(api.cart.remove);
  const addToCartMutation = useMutation(api.cart.add);
  const [isBuyingNow, setIsBuyingNow] = useState(false);

  const [quantity, setQuantity] = useState(1);
  const [isUpdatingCart, setIsUpdatingCart] = useState(false);
  const [bundleAddLoading, setBundleAddLoading] = useState<2 | 3 | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [guestCartQuantity, setGuestCartQuantity] = useState(0);
  const { trackAddToCart } = useMetaTracking();

  function trackSelectedVariantAdded(quantityAdded: number) {
    trackAddToCart({
      content_ids: [String(_id)],
      content_name: name,
      content_type: "product",
      contents: [
        {
          id: String(_id),
          quantity: quantityAdded,
          item_price: effectivePrice,
        },
      ],
      currency: "BDT",
      num_items: quantityAdded,
      value: effectivePrice * quantityAdded,
    });
  }

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
    new Set(
      variantsForSize.map((v) => v.color).filter((c): c is string => !!c),
    ),
  );

  // Also get all colors across all sizes for the color picker
  const allColors = Array.from(
    new Set(variants.map((v) => v.color).filter((c): c is string => !!c)),
  );

  const selectedVariant =
    selectedSize && uniqueColors.length === 0
      ? (variantsForSize[0] ?? null)
      : selectedSize && selectedColor
        ? (variantsForSize.find((v) => v.color === selectedColor) ?? null)
        : null;

  const selectedVariantId = selectedVariant?._id ?? null;
  const isDiscounted = discountAmount > 0;
  const discountPct = isDiscounted
    ? Math.round((discountAmount / basePrice) * 100)
    : 0;

  // Check if selected variant is in cart
  const cartItem =
    selectedVariantId && cartItems
      ? cartItems.find((item) => item.variantId === selectedVariantId)
      : null;

  useEffect(() => {
    if (session || !selectedVariantId) {
      setGuestCartQuantity(0);
      return;
    }

    const item = getGuestCart().find(
      (guestItem) => guestItem.variantId === (selectedVariantId as string),
    );
    setGuestCartQuantity(item?.quantity ?? 0);
  }, [guestItemCount, selectedVariantId, session]);

  const isGuestInCart = !session && guestCartQuantity > 0;
  const isInCart = !!cartItem || isGuestInCart;

  // If in cart, local quantity should match cart quantity (if not currently being edited)
  const displayQuantity = cartItem
    ? cartItem.quantity
    : isGuestInCart
      ? guestCartQuantity
      : quantity;
  const isBundleAddDisabled = !selectedVariantId || bundleAddLoading !== null;

  /** Add selected qty to cart (auth or guest) then go straight to checkout. */
  async function handleBuyNow() {
    if (!selectedVariantId) return;
    setIsBuyingNow(true);
    try {
      if (session) {
        await addToCartMutation({
          productId: _id,
          variantId: selectedVariantId,
          quantity,
        });
      } else {
        addGuestItem(_id, selectedVariantId, quantity);
      }
      trackSelectedVariantAdded(quantity);
      router.push("/checkout");
    } catch {
      toast.error("Could not proceed to checkout");
      setIsBuyingNow(false);
    }
  }

  async function addSelectedVariantQuantity(quantityToAdd: 2 | 3) {
    if (!selectedVariantId) return;

    setBundleAddLoading(quantityToAdd);
    try {
      if (session) {
        await addToCartMutation({
          productId: _id,
          variantId: selectedVariantId,
          quantity: quantityToAdd,
        });
      } else {
        addGuestItem(_id, selectedVariantId, quantityToAdd);
      }
      trackSelectedVariantAdded(quantityToAdd);
      toast.success(`${quantityToAdd} items added to cart`);
    } catch {
      toast.error("Failed to add to cart");
    } finally {
      setBundleAddLoading(null);
    }
  }

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
        <p className="text-xs text-muted-foreground -mt-3">
          {discountGroupName}
        </p>
      )}
      {isDiscounted && discountEndTime && (
        <div className="-mt-2">
          <SaleCountdownTimer endTime={discountEndTime} />
        </div>
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
                    setSelectedColor(color, { jumpToMedia: true });
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
            {/*
              Size guide is intentionally hidden for launch. Keep this button
              dormant so it can be restored when the guide content is ready.
            <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
              <Info className="h-3 w-3" />
              Size guide
            </button>
            */}
          </div>
          {/* Show measurement hint if available */}
          {selectedSize && (
            <p className="text-xs text-muted-foreground">
              {
                platformSizes.find((ps) => ps.name === selectedSize)
                  ?.measurements
              }
            </p>
          )}
          <SizeSelector
            sizes={sizesWithStock}
            selectedSize={selectedSize}
            onChange={(size) => {
              setSelectedSize(size);
              // Color reconciliation for the new size
              const variantsForNewSize = variants.filter(
                (v) => v.size === size,
              );
              const isColorStillValid = variantsForNewSize.some(
                (v) => v.color === selectedColor && v.stock > 0,
              );

              if (!isColorStillValid) {
                const firstInStock = variantsForNewSize.find(
                  (v) => v.stock > 0,
                );
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

      {/* Bundle Discount Hints */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => addSelectedVariantQuantity(2)}
          disabled={isBundleAddDisabled}
          className="flex-1 border border-border/60 bg-muted/30 px-3 py-2.5 text-center transition-colors hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Add 2 selected items to cart"
        >
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Buy 2+
          </p>
          <p className="text-xs font-bold mt-0.5">
            {bundleAddLoading === 2 ? (
              <Loader2 className="mx-auto h-3.5 w-3.5 animate-spin" />
            ) : (
              "Save 10%"
            )}
          </p>
        </button>
        <button
          type="button"
          onClick={() => addSelectedVariantQuantity(3)}
          disabled={isBundleAddDisabled}
          className="flex-1 border border-border/60 bg-muted/30 px-3 py-2.5 text-center transition-colors hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Add 3 selected items to cart"
        >
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Buy 3+
          </p>
          <p className="text-xs font-bold mt-0.5">
            {bundleAddLoading === 3 ? (
              <Loader2 className="mx-auto h-3.5 w-3.5 animate-spin" />
            ) : (
              "Save 15% + Free Delivery"
            )}
          </p>
        </button>
      </div>

      {/* Quantity & Actions */}
      <div ref={addToCartRef} className="space-y-4 pt-1">
        <p className="text-sm font-medium">Quantity</p>
        <div className="flex gap-4 items-stretch">
          <div className="flex items-center gap-0 border border-border w-fit shrink-0">
            {isInCart && displayQuantity === 1 ? (
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
                  if (cartItem) {
                    setIsUpdatingCart(true);
                    await updateCartQty({
                      cartItemId: cartItem._id,
                      quantity: cartItem.quantity - 1,
                    });
                    setIsUpdatingCart(false);
                  } else if (isGuestInCart && selectedVariantId) {
                    updateGuestQuantity(
                      selectedVariantId as string,
                      guestCartQuantity - 1,
                    );
                  } else {
                    setQuantity((q) => Math.max(1, q - 1));
                  }
                }}
              disabled={
                  displayQuantity <= 1 || isUpdatingCart
                }
              >
                −
              </button>
            )}
            <span className="h-11 w-12 flex items-center justify-center text-sm font-medium border-x border-border">
              {isUpdatingCart ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                displayQuantity
              )}
            </span>
            <button
              type="button"
              className="h-11 w-11 flex items-center justify-center hover:bg-muted transition-colors text-lg disabled:opacity-40"
                onClick={async () => {
                if (cartItem) {
                  setIsUpdatingCart(true);
                  await updateCartQty({
                    cartItemId: cartItem._id,
                    quantity: cartItem.quantity + 1,
                  });
                  setIsUpdatingCart(false);
                } else if (isGuestInCart && selectedVariantId) {
                  updateGuestQuantity(
                    selectedVariantId as string,
                    guestCartQuantity + 1,
                  );
                } else {
                  setQuantity((q) => q + 1);
                }
              }}
              disabled={
                (selectedVariant
                  ? displayQuantity >= selectedVariant.stock
                  : false) || isUpdatingCart
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
                productName={name}
                unitPrice={effectivePrice}
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

        {/* Buy Now & Wishlist Buttons */}
        <div className="flex gap-4">
          <div className="flex-1">
            {!isInCart ? (
              <button
                type="button"
                disabled={!selectedVariantId || isBuyingNow}
                onClick={handleBuyNow}
                className="w-full h-11 border border-border bg-background text-foreground text-xs font-semibold tracking-wider uppercase flex items-center justify-center gap-2 hover:bg-muted transition-colors disabled:opacity-40"
              >
                {isBuyingNow ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <ShoppingBag className="h-4 w-4" />
                    Buy Now
                  </>
                )}
              </button>
            ) : (
              <Link
                href="/checkout"
                prefetch={false}
                className="w-full h-11 border border-border bg-background text-foreground text-xs font-semibold tracking-wider uppercase flex items-center justify-center gap-2 hover:bg-muted transition-colors"
              >
                <ShoppingBag className="h-4 w-4" />
                Checkout
              </Link>
            )}
          </div>
          <div className="flex-1">
            <WishlistButton productId={_id} variant="full" />
          </div>
        </div>
      </div>

      {/* Tags */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {tags.map((tag) => (
            <span
              key={tag._id}
              className={`text-[10px] tracking-wider uppercase px-2 py-0.5 border ${tag.name.toLowerCase().includes("sale") || tag.name.toLowerCase().includes("off") ? "bg-red-600 text-white border-red-600" : "bg-emerald-600 text-white border-emerald-600"}`}
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
                } else if (isGuestInCart && selectedVariantId) {
                  removeGuestItem(selectedVariantId as string);
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
