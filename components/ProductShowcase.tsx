"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

// ─── Types ──────────────────────────────────────────────────────
export interface ShowcaseProduct {
  _id: string;
  name: string;
  slug: string;
  basePrice: number;
  effectivePrice: number;
  discountAmount: number;
  discountGroupName: string | null;
  imageUrl: string | null;
  colors: string[];
  sortOrder: number;
}

interface ProductShowcaseProps {
  heading: string;
  products: ShowcaseProduct[];
}



// ─── Component ──────────────────────────────────────────────────
export function ProductShowcase({ heading, products }: ProductShowcaseProps) {
  const platformColors = useQuery(api.platformConfig.listColors);
  const colorHexMap: Record<string, string> = platformColors
    ? Object.fromEntries(platformColors.map((c) => [c.name.toLowerCase(), c.hexCode]))
    : {};

  function resolveColorHex(colorName: string): string {
    return colorHexMap[colorName.toLowerCase()] ?? "#cccccc";
  }
  const [offset, setOffset] = useState(0);
  const [visibleCount, setVisibleCount] = useState(3);
  const containerRef = useRef<HTMLDivElement>(null);

  // Determine visible count based on container width
  useEffect(() => {
    function updateCount() {
      if (!containerRef.current) return;
      const w = containerRef.current.offsetWidth;
      if (w >= 1024) setVisibleCount(3);
      else if (w >= 640) setVisibleCount(2);
      else setVisibleCount(1);
    }
    updateCount();
    window.addEventListener("resize", updateCount);
    return () => window.removeEventListener("resize", updateCount);
  }, []);

  const maxOffset = Math.max(0, products.length - visibleCount);

  const prev = useCallback(
    () => setOffset((o) => Math.max(0, o - 1)),
    []
  );
  const next = useCallback(
    () => setOffset((o) => Math.min(maxOffset, o + 1)),
    [maxOffset]
  );

  if (products.length === 0) return null;

  const visibleProducts = products.slice(offset, offset + visibleCount);
  const canPrev = offset > 0;
  const canNext = offset < maxOffset;

  return (
    <section className="w-full bg-white py-20 md:py-28 border-t border-border">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-10" ref={containerRef}>
        {/* Section Header */}
        <div className="mb-12 md:mb-16">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-thin tracking-[0.22em] uppercase text-foreground leading-snug">
            {heading}
          </h2>
        </div>

        {/* Product Grid */}
        <div
          className="grid gap-5 md:gap-6"
          style={{
            gridTemplateColumns: `repeat(${visibleCount}, minmax(0, 1fr))`,
          }}
        >
          {visibleProducts.map((product) => {
            const isDiscounted = product.discountAmount > 0;
            const discountPct = isDiscounted
              ? Math.round((product.discountAmount / product.basePrice) * 100)
              : 0;

            return (
              <div key={product._id} className="product-card-wrapper group">
                {/* Image Container */}
                <Link
                  href={`/products/${product.slug}`}
                  className="block relative aspect-[3/4] overflow-hidden bg-[#f0f0f0]"
                >
                  {product.imageUrl ? (
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground/50 text-sm tracking-wide">
                      No image
                    </div>
                  )}

                  {/* Discount Badge */}
                  {isDiscounted && (
                    <div className="absolute top-4 left-4">
                      <span className="bg-foreground text-white text-[10px] font-semibold tracking-[0.15em] uppercase px-3 py-1.5">
                        {discountPct}% OFF
                      </span>
                    </div>
                  )}

                  {/* Add to Cart Overlay */}
                  <div className="product-card-overlay">
                    <span className="bg-white text-foreground text-[11px] font-semibold tracking-[0.2em] uppercase px-7 py-2.5 hover:bg-foreground hover:text-white transition-colors duration-200">
                      Add to Cart
                    </span>
                  </div>
                </Link>

                {/* Product Info */}
                <div className="mt-4 space-y-2.5">
                  <Link
                    href={`/products/${product.slug}`}
                    className="block"
                  >
                    <p className="text-sm text-foreground leading-snug tracking-wide line-clamp-1 group-hover:underline underline-offset-2">
                      {product.name}
                    </p>
                  </Link>

                  {/* Price */}
                  <div className="flex items-center gap-2.5">
                    <span className="text-sm font-semibold text-foreground">
                      &#2547;{product.effectivePrice.toLocaleString()}
                    </span>
                    {isDiscounted && (
                      <span className="text-xs text-muted-foreground line-through">
                        &#2547;{product.basePrice.toLocaleString()}
                      </span>
                    )}
                  </div>

                  {/* Color Swatches */}
                  {product.colors.length > 0 && (
                    <div className="flex items-center gap-1.5 pt-0.5">
                      {product.colors.slice(0, 5).map((color) => (
                        <span
                          key={color}
                          className="w-3.5 h-3.5 rounded-full border border-gray-300"
                          style={{ backgroundColor: resolveColorHex(color) }}
                          title={color}
                        />
                      ))}
                      {product.colors.length > 5 && (
                        <span className="text-[10px] text-muted-foreground ml-0.5">
                          +{product.colors.length - 5}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Navigation Arrows */}
        {products.length > visibleCount && (
          <div className="flex items-center justify-end gap-3 mt-10">
            <button
              onClick={prev}
              disabled={!canPrev}
              aria-label="Previous products"
              className="w-10 h-10 rounded-full border border-gray-300 flex items-center justify-center text-gray-500 transition-all duration-200 hover:border-foreground hover:text-foreground disabled:opacity-25 disabled:cursor-not-allowed disabled:hover:border-gray-300 disabled:hover:text-gray-500"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 14 14"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M9 2L4 7L9 12" />
              </svg>
            </button>
            <button
              onClick={next}
              disabled={!canNext}
              aria-label="Next products"
              className="w-10 h-10 rounded-full border border-gray-300 flex items-center justify-center text-gray-500 transition-all duration-200 hover:border-foreground hover:text-foreground disabled:opacity-25 disabled:cursor-not-allowed disabled:hover:border-gray-300 disabled:hover:text-gray-500"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 14 14"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M5 2L10 7L5 12" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
