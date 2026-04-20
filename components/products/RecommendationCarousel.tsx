"use client";

import { useState, useCallback, useEffect } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import ProductCard from "@/components/products/ProductCard";
import { Id } from "@/convex/_generated/dataModel";

interface RecProduct {
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
  imageUrl: string | null;
  tags?: Array<{ _id: string; name: string; slug: string }>;
  variants?: Array<{ color?: string }>;
}

interface RecommendationCarouselProps {
  products: RecProduct[];
}

export default function RecommendationCarousel({
  products,
}: RecommendationCarouselProps) {
  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: false,
    align: "start",
    dragFree: false,
  });

  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [snapCount, setSnapCount] = useState(0);

  const onInit = useCallback(() => {
    if (!emblaApi) return;
    setSnapCount(emblaApi.scrollSnapList().length);
  }, [emblaApi]);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setCanScrollPrev(emblaApi.canScrollPrev());
    setCanScrollNext(emblaApi.canScrollNext());
    setCurrentIndex(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    onInit();
    onSelect();
    emblaApi.on("reInit", onInit);
    emblaApi.on("reInit", onSelect);
    emblaApi.on("select", onSelect);
    return () => {
      emblaApi.off("reInit", onInit);
      emblaApi.off("reInit", onSelect);
      emblaApi.off("select", onSelect);
    };
  }, [emblaApi, onInit, onSelect]);

  if (products.length === 0) return null;

  return (
    <div>
      {/* Carousel */}
      <div ref={emblaRef} className="overflow-hidden">
        <div className="flex gap-4 md:gap-6">
          {products.map((product) => (
            <div
              key={product._id}
              className="flex-[0_0_calc(50%-8px)] sm:flex-[0_0_calc(33.333%-11px)] lg:flex-[0_0_calc(25%-12px)]"
            >
              <ProductCard
                product={{
                  _id: product._id,
                  name: product.name,
                  slug: product.slug,
                  basePrice: product.basePrice,
                  effectivePrice: product.effectivePrice,
                  discountAmount: product.discountAmount,
                  discountGroupName: product.discountGroupName,
                  discountEndTime: product.discountEndTime ?? null,
                  averageRating: product.averageRating,
                  totalRatings: product.totalRatings,
                  media: [],
                  tags: product.tags,
                  variants: product.variants,
                }}
                imageUrl={product.imageUrl}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Controls: progress bar + arrows */}
      {snapCount > 1 && (
        <div className="flex items-center gap-6 mt-6">
          {/* Proportional progress bar */}
          <div className="flex-1 h-0.5 bg-gray-200 relative overflow-hidden">
            <div
              className="absolute top-0 left-0 h-full bg-foreground transition-all duration-300 ease-out"
              style={{
                width: `${snapCount > 0 ? 100 / snapCount : 100}%`,
                transform: `translateX(${currentIndex * 100}%)`,
              }}
            />
          </div>

          <div className="flex gap-2 flex-shrink-0">
            <button
              onClick={() => emblaApi?.scrollPrev()}
              disabled={!canScrollPrev}
              className="h-11 w-11 rounded-full border border-border flex items-center justify-center hover:bg-muted disabled:opacity-30 transition-colors"
              aria-label="Previous"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={() => emblaApi?.scrollNext()}
              disabled={!canScrollNext}
              className="h-11 w-11 rounded-full border border-border flex items-center justify-center hover:bg-muted disabled:opacity-30 transition-colors"
              aria-label="Next"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
