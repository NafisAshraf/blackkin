"use client";

import Link from "next/link";
import { Id } from "@/convex/_generated/dataModel";

interface ProductCardProps {
  product: {
    _id: Id<"products">;
    name: string;
    slug: string;
    basePrice: number;
    discountedPrice: number;
    discountAmount: number;
    campaignName: string | null;
    averageRating: number;
    totalRatings: number;
    media: Array<{
      storageId: Id<"_storage">;
      type: "image" | "video";
      sortOrder: number;
    }>;
    tags?: Array<{
      _id: string;
      name: string;
      slug: string;
    }>;
  };
  imageUrl?: string | null;
}

function getTagStyle(tagName: string): {
  bg: string;
  text: string;
  label: string;
} {
  const lower = tagName.toLowerCase();
  if (lower.includes("new") || lower.includes("arrival")) {
    return {
      bg: "bg-emerald-600",
      text: "text-white",
      label: "NEW ARRIVALS",
    };
  }
  if (lower.includes("best") || lower.includes("seller")) {
    return {
      bg: "bg-red-600",
      text: "text-white",
      label: "BEST SELLER",
    };
  }
  if (lower.includes("popular")) {
    return {
      bg: "bg-blue-600",
      text: "text-white",
      label: "MOST POPULAR",
    };
  }
  if (lower.includes("free") || lower.includes("delivery")) {
    return {
      bg: "bg-emerald-600",
      text: "text-white",
      label: "🚚 FREE DELIVERY",
    };
  }
  if (lower.includes("sale") || lower.includes("off")) {
    return {
      bg: "bg-red-600",
      text: "text-white",
      label: tagName.toUpperCase(),
    };
  }
  return {
    bg: "bg-gray-700",
    text: "text-white",
    label: tagName.toUpperCase(),
  };
}

function StarRating({ rating }: { rating: number }) {
  const stars = [];
  for (let i = 1; i <= 5; i++) {
    stars.push(
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
    );
  }
  return <span className="text-sm">{stars}</span>;
}

export default function ProductCard({ product, imageUrl }: ProductCardProps) {
  const {
    name,
    slug,
    basePrice,
    discountedPrice,
    discountAmount,
    campaignName,
    averageRating,
    totalRatings,
    tags,
  } = product;
  const isDiscounted = discountAmount > 0;

  // Pick the first tag for badge display
  const primaryTag = tags && tags.length > 0 ? tags[0] : null;
  const tagStyle = primaryTag ? getTagStyle(primaryTag.name) : null;

  return (
    <Link href={`/products/${slug}`} className="block group">
      <div className="product-card-wrapper">
        <div className="aspect-square relative overflow-hidden bg-muted">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={name}
              className="object-cover w-full h-full transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">
              No image
            </div>
          )}

          {/* Tag badge */}
          {tagStyle && (
            <div className="absolute top-3 left-3">
              <span
                className={`${tagStyle.bg} ${tagStyle.text} text-[10px] font-semibold tracking-wider px-2.5 py-1 uppercase`}
              >
                {tagStyle.label}
              </span>
            </div>
          )}

          {/* Discount badge */}
          {isDiscounted && !tagStyle && (
            <div className="absolute top-3 left-3">
              <span className="bg-red-600 text-white text-[10px] font-semibold tracking-wider px-2.5 py-1 uppercase">
                {Math.round((discountAmount / basePrice) * 100)}% OFF
              </span>
            </div>
          )}

          {/* Hover overlay with quick add */}
          <div className="product-card-overlay">
            <span className="bg-white text-foreground text-xs font-semibold tracking-wider uppercase px-6 py-2.5 hover:bg-foreground hover:text-white transition-colors">
              Add to Cart
            </span>
          </div>
        </div>

        {/* Product Info */}
        <div className="pt-3 space-y-1.5">
          <p className="text-sm leading-tight line-clamp-2">{name}</p>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold">
              ৳{discountedPrice.toLocaleString()}
            </span>
            {isDiscounted && (
              <span className="text-xs text-muted-foreground line-through">
                ৳{basePrice.toLocaleString()}
              </span>
            )}
          </div>
          {totalRatings > 0 && (
            <div className="flex items-center gap-1">
              <StarRating rating={averageRating} />
              <span className="text-xs text-muted-foreground">
                ({totalRatings})
              </span>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
