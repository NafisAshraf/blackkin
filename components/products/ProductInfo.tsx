"use client";

import { useState } from "react";
import { Heart, Loader2, ShoppingCart, Info } from "lucide-react";
import SizeSelector from "./SizeSelector";
import AddToCartButton from "@/components/cart/AddToCartButton";
import WishlistButton from "@/components/wishlist/WishlistButton";
import { Id } from "@/convex/_generated/dataModel";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { addToGuestCart } from "@/lib/guest-cart";

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
    discountedPrice: number;
    discountAmount: number;
    campaignName: string | null;
    averageRating: number;
    totalRatings: number;
    variants: Variant[];
    tags: Tag[];
  };
  platformSizes: PlatformSize[];
}

// Color name → hex map for swatches
const COLOR_HEX: Record<string, string> = {
  black: "#1a1a1a",
  white: "#ffffff",
  gray: "#9ca3af",
  grey: "#9ca3af",
  blue: "#3b82f6",
  navy: "#1e3a5f",
  red: "#ef4444",
  green: "#22c55e",
  yellow: "#eab308",
  purple: "#a855f7",
  pink: "#ec4899",
  orange: "#f97316",
  brown: "#92400e",
  beige: "#d4c5a9",
  "light blue": "#93c5fd",
  "dark blue": "#1e40af",
  "sky blue": "#7dd3fc",
};

function getColorHex(colorName?: string): string {
  if (!colorName) return "#ccc";
  const lower = colorName.toLowerCase();
  for (const [key, hex] of Object.entries(COLOR_HEX)) {
    if (lower.includes(key)) return hex;
  }
  return "#ccc";
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
  const {
    _id,
    name,
    basePrice,
    discountedPrice,
    discountAmount,
    campaignName,
    averageRating,
    totalRatings,
    variants,
    tags,
  } = product;

  const { data: session } = authClient.useSession();

  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);

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
          ৳{discountedPrice.toLocaleString()}
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
      {campaignName && (
        <p className="text-xs text-muted-foreground -mt-3">{campaignName}</p>
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
                  onClick={() => {
                    setSelectedColor(color);
                  }}
                  className={`h-7 w-7 rounded-full border-2 transition-all ${
                    isSelected
                      ? "border-foreground scale-110 shadow-sm"
                      : "border-transparent hover:border-gray-400"
                  }`}
                  style={{
                    backgroundColor: hex,
                    boxShadow:
                      hex === "#ffffff" ? "inset 0 0 0 1px #e5e7eb" : undefined,
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
            }}
          />
        </div>
      )}

      {/* Quantity */}
      <div className="space-y-2">
        <p className="text-sm font-medium">Quantity</p>
        <div className="flex items-center gap-0 border border-border w-fit">
          <button
            className="h-10 w-10 flex items-center justify-center hover:bg-muted transition-colors text-lg disabled:opacity-40"
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            disabled={quantity <= 1}
          >
            −
          </button>
          <span className="h-10 w-12 flex items-center justify-center text-sm font-medium border-x border-border">
            {quantity}
          </span>
          <button
            className="h-10 w-10 flex items-center justify-center hover:bg-muted transition-colors text-lg disabled:opacity-40"
            onClick={() => setQuantity((q) => q + 1)}
            disabled={
              selectedVariant ? quantity >= selectedVariant.stock : false
            }
          >
            +
          </button>
        </div>
      </div>

      {/* CTA Buttons */}
      <div className="space-y-2.5 pt-1">
        {/* Add to Cart */}
        <AddToCartButton
          productId={_id}
          variantId={selectedVariantId}
          disabled={!selectedVariantId}
          quantity={quantity}
          onSuccess={() => setQuantity(1)}
        />

        {/* Buy It Now */}
        <button
          className="w-full h-11 border border-foreground bg-background text-foreground text-xs font-semibold tracking-wider uppercase hover:bg-foreground hover:text-background transition-colors flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
          disabled={!selectedVariantId}
          onClick={() => {
            if (!selectedVariantId) return;
            window.location.href = session ? "/checkout" : "/login?next=/checkout";
          }}
        >
          Buy It Now
        </button>

        {/* Save to Wishlist */}
        <div className="flex justify-center">
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
    </div>
  );
}
