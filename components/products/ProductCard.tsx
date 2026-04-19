"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Id } from "@/convex/_generated/dataModel";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

interface ProductCardProps {
  product: {
    _id: Id<"products">;
    name: string;
    slug: string;
    basePrice: number;
    effectivePrice: number;
    discountAmount: number;
    discountGroupName: string | null;
    discountEndTime?: number | null;
    averageRating: number;
    totalRatings: number;
    media: Array<{
      storageId: string;
      type: "image" | "video" | "model3d";
      sortOrder: number;
    }>;
    tags?: Array<{
      _id: string;
      name: string;
      slug: string;
    }>;
    variants?: Array<{
      color?: string;
    }>;
  };
  imageUrl?: string | null;
}

function useColorHexMap(): Record<string, string> {
  const colors = useQuery(api.platformConfig.listColors);
  if (!colors) return {};
  const map: Record<string, string> = {};
  for (const c of colors) {
    map[c.name.toLowerCase()] = c.hexCode;
  }
  return map;
}

function getColorHexFromMap(map: Record<string, string>, colorName: string): string {
  return map[colorName.toLowerCase()] ?? "#cccccc";
}

function StarRating({ rating }: { rating: number }) {
  return (
    <span className="text-sm">
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className={
            i <= Math.round(rating)
              ? "text-yellow-400"
              : "text-muted-foreground/25"
          }
        >
          &#9733;
        </span>
      ))}
    </span>
  );
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
    <span className="flex items-center gap-0.5 text-[9px] font-medium tracking-wide mt-0.5 text-white/90">
      ⏱ {label}
    </span>
  );
}

function TagBadge({ name }: { name: string }) {
  const lower = name.toLowerCase();
  let bg = "bg-gray-700";
  if (lower.includes("new") || lower.includes("arrival")) bg = "bg-emerald-600";
  else if (lower.includes("best") || lower.includes("seller"))
    bg = "bg-red-600";
  else if (lower.includes("popular")) bg = "bg-blue-600";
  else if (lower.includes("free") || lower.includes("delivery"))
    bg = "bg-emerald-600";
  else if (lower.includes("sale") || lower.includes("off")) bg = "bg-red-600";
  return (
    <span
      className={`${bg} text-white text-[10px] font-semibold tracking-wider px-2 py-0.5 uppercase`}
    >
      {name}
    </span>
  );
}

export default function ProductCard({ product, imageUrl }: ProductCardProps) {
  const colorMap = useColorHexMap();
  const {
    name,
    slug,
    basePrice,
    effectivePrice,
    discountAmount,
    discountEndTime,
    averageRating,
    totalRatings,
    tags,
    variants,
  } = product;
  const isDiscounted = discountAmount > 0;
  const discountPct = isDiscounted
    ? Math.round((discountAmount / basePrice) * 100)
    : 0;

  // Show last 2 tags (end of array = most recently added)
  const displayTags = tags && tags.length > 0 ? tags.slice(-2) : [];

  // Unique colors from variants (up to 5)
  const uniqueColors = variants
    ? Array.from(
        new Set(variants.map((v) => v.color).filter((c): c is string => !!c)),
      ).slice(0, 5)
    : [];

  return (
    <Link href={`/products/${slug}`} className="block group">
      <div className="product-card-wrapper">
        {/* Image container */}
        <div className="aspect-[4/5] relative overflow-hidden bg-muted">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl}
              alt={name}
              className="object-cover w-full h-full transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm bg-muted" />
          )}

          {/* Discount badge — top left */}
          {isDiscounted && (
            <div className="absolute top-3 left-3 z-10">
              <div className="bg-red-600 px-2.5 py-1.5 flex flex-col items-start shadow-sm">
                <span className="text-white text-[10px] font-bold tracking-wider uppercase">
                  -{discountPct}% OFF
                </span>
                {discountEndTime && (
                  <SaleCountdownTimer endTime={discountEndTime} />
                )}
              </div>
            </div>
          )}

          {/* Tags — top right (max 2) */}
          {!isDiscounted && displayTags.length > 0 && (
            <div className="absolute top-3 left-3 z-10 flex flex-col gap-1">
              {displayTags.map((tag) => (
                <TagBadge key={tag._id} name={tag.name} />
              ))}
            </div>
          )}
          {isDiscounted && displayTags.length > 0 && (
            <div className="absolute top-3 right-3 z-10 flex flex-col gap-1 items-end">
              {displayTags.map((tag) => (
                <TagBadge key={tag._id} name={tag.name} />
              ))}
            </div>
          )}
        </div>

        {/* Product info */}
        <div className="pt-3 space-y-1.5">
          <p className="text-sm leading-tight line-clamp-2 group-hover:text-foreground transition-colors">
            {name}
          </p>



          {/* Rating */}
          {totalRatings > 0 && (
            <div className="flex items-center gap-1">
              <StarRating rating={averageRating} />
              <span className="text-xs text-muted-foreground">
                ({totalRatings})
              </span>
            </div>
          )}

          {/* Color swatches */}
          {uniqueColors.length > 0 && (
            <div className="flex items-center gap-1.5 pt-0.5">
              {uniqueColors.map((color) => {
                const hex = getColorHexFromMap(colorMap, color);
                return (
                  <span
                    key={color}
                    title={color}
                    className="h-4 w-4 rounded-full border border-gray-300 flex-shrink-0"
                    style={{ backgroundColor: hex }}
                  />
                );
              })}
              {(variants
                ? Array.from(
                    new Set(variants.map((v) => v.color).filter(Boolean)),
                  ).length
                : 0) > 5 && (
                <span className="text-xs text-muted-foreground">
                  +
                  {(variants
                    ? Array.from(
                        new Set(variants.map((v) => v.color).filter(Boolean)),
                      ).length
                    : 0) - 5}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
