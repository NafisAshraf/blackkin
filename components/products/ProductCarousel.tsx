"use client";

import { useState, useRef, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import ProductCard from "./ProductCard";
import { Id } from "@/convex/_generated/dataModel";

interface Product {
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
  imageUrl?: string | null;
}

interface ProductCarouselProps {
  products: Product[];
  title: string;
  viewAllHref?: string;
}

export default function ProductCarousel({
  products,
  title,
  viewAllHref,
}: ProductCarouselProps) {
  const [startIndex, setStartIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Responsive: show 3 on desktop, 2 on tablet, 1 on mobile
  // We use CSS grid for display but track index in JS for arrow nav
  const getVisibleCount = useCallback(() => {
    if (typeof window === "undefined") return 3;
    if (window.innerWidth < 640) return 1;
    if (window.innerWidth < 1024) return 2;
    return 3;
  }, []);

  const canGoLeft = startIndex > 0;
  const canGoRight = startIndex + 3 < products.length;

  const goLeft = () => {
    setStartIndex((prev) => Math.max(0, prev - 1));
  };

  const goRight = () => {
    setStartIndex((prev) => Math.min(products.length - 1, prev + 1));
  };

  if (products.length === 0) return null;

  // Determine visible slice (always show up to 3 on desktop, handled by CSS)
  const visibleProducts = products.slice(startIndex, startIndex + 3);
  // For mobile: we let all be scrollable via CSS
  const allFromStart = products.slice(startIndex);

  return (
    <section className="w-full py-12 px-6 lg:px-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-xl md:text-2xl font-semibold tracking-tight uppercase">
          {title}
        </h2>
        <div className="flex items-center gap-3">
          {viewAllHref && (
            <a
              href={viewAllHref}
              className="text-xs font-medium text-muted-foreground hover:text-foreground uppercase tracking-wider transition-colors hidden sm:block"
            >
              View All Products
            </a>
          )}
          <div className="flex items-center gap-1">
            <button
              onClick={goLeft}
              disabled={!canGoLeft}
              className="h-8 w-8 rounded-full border border-border flex items-center justify-center hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              aria-label="Previous products"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={goRight}
              disabled={!canGoRight}
              className="h-8 w-8 rounded-full border border-border flex items-center justify-center hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              aria-label="Next products"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Desktop: grid view */}
      <div className="hidden md:grid grid-cols-3 gap-6" ref={containerRef}>
        {visibleProducts.map((product) => (
          <ProductCard
            key={product._id}
            product={product}
            imageUrl={product.imageUrl}
          />
        ))}
      </div>

      {/* Mobile: scrollable */}
      <div className="md:hidden">
        <div className="grid grid-cols-2 gap-3">
          {visibleProducts.slice(0, 2).map((product) => (
            <ProductCard
              key={product._id}
              product={product}
              imageUrl={product.imageUrl}
            />
          ))}
        </div>
      </div>

      {/* Dot indicators */}
      {products.length > 3 && (
        <div className="flex items-center justify-center gap-1.5 mt-6">
          {Array.from({ length: Math.ceil(products.length - 2) }).map(
            (_, i) => (
              <button
                key={i}
                onClick={() => setStartIndex(i)}
                className={`h-2 w-2 rounded-full transition-colors ${
                  i === startIndex
                    ? "bg-foreground"
                    : "bg-muted-foreground/30"
                }`}
                aria-label={`Go to page ${i + 1}`}
              />
            )
          )}
        </div>
      )}
    </section>
  );
}
