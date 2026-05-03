"use client";

import { useState } from "react";
import Link from "next/link";
import MediaGallery from "@/components/products/MediaGallery";
import ProductInfo from "@/components/products/ProductInfo";
import ProductAccordion from "@/components/products/ProductAccordion";
import RecommendationCarousel from "@/components/products/RecommendationCarousel";
import ReviewList from "@/components/reviews/ReviewList";
import { Id } from "@/convex/_generated/dataModel";

// ─── Types ────────────────────────────────────────────────────

interface ResolvedMediaItem {
  storageId: string;
  type: "image" | "video" | "model3d";
  sortOrder: number;
  url: string | null;
}

interface ResolvedVariantMediaEntry {
  color: string;
  media: ResolvedMediaItem[];
}

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

interface Recommendation {
  _id: Id<"products">;
  name: string;
  slug: string;
  basePrice: number;
  effectivePrice: number;
  discountAmount: number;
  discountGroupName: string | null;
  discountEndTime: number | null;
  averageRating: number;
  totalRatings: number;
  imageUrl: string | null;
  colorFirstImageUrls: Array<{ color: string; url: string | null }>;
  tags?: Array<{ _id: string; name: string; slug: string }>;
  variants?: Array<{ color?: string }>;
}

interface PlatformSize {
  name: string;
  measurements?: string;
}

interface ProductDetailClientProps {
  product: {
    _id: Id<"products">;
    name: string;
    description: string;
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
  thumbnailUrl: string | null;
  variantMediaResolved: ResolvedVariantMediaEntry[];
  platformSizes: PlatformSize[];
  recommendations: Recommendation[];
}

// ─── Component ────────────────────────────────────────────────

export default function ProductDetailClient({
  product,
  thumbnailUrl,
  variantMediaResolved,
  platformSizes,
  recommendations,
}: ProductDetailClientProps) {
  // Pre-select color from first available variant
  const initialColor =
    product.variants.find((v) => v.stock > 0)?.color ??
    product.variants[0]?.color ??
    null;

  const [selectedColor, setSelectedColor] = useState<string | null>(
    initialColor,
  );

  // Compute active media for the selected color
  const activeVariantEntry = variantMediaResolved.find(
    (e) => e.color === selectedColor,
  );
  const activeMedia: ResolvedMediaItem[] = activeVariantEntry?.media.length
    ? activeVariantEntry.media
    : thumbnailUrl
      ? [{ storageId: "__thumbnail__", type: "image", sortOrder: 0, url: thumbnailUrl }]
      : [];

  return (
    <>
      {/* ── MOBILE layout: stacked ─────────────────────────── */}
      <div className="lg:hidden">
        <section className="w-full">
          <MediaGallery media={activeMedia} />
        </section>
        <section className="px-5 py-6 space-y-6">
          <ProductInfo
            product={product}
            platformSizes={platformSizes}
            selectedColor={selectedColor}
            onColorChange={setSelectedColor}
          />
          <ProductAccordion description={product.description ?? ""} />

          {/* Mobile reviews */}
          {/* <section>
            <h2 className="text-base font-semibold mb-4">Customer Reviews</h2>
            <ReviewList productId={product._id} />
          </section> */}
        </section>
      </div>

      {/* ── DESKTOP layout: 50/50 sticky ───────────────────── */}
      <div className="hidden lg:flex w-full">
        {/* Left: media stack */}
        <div className="w-1/2 flex-shrink-0">
          <MediaGallery media={activeMedia} />
        </div>

        {/* Right: sticky info column */}
        <div className="w-1/2 flex-shrink-0 px-10 pt-10">
          <div className="sticky top-[70px]">
            {/* Breadcrumb */}
            <nav className="text-xs text-muted-foreground flex items-center gap-1.5 flex-wrap mb-6">
              <Link href="/" className="hover:text-foreground transition-colors">
                Home
              </Link>
              <span>/</span>
              <Link
                href="/products"
                className="hover:text-foreground transition-colors"
              >
                Products
              </Link>
              <span>/</span>
              <span className="text-foreground">{product.name}</span>
            </nav>

            <ProductInfo
              product={product}
              platformSizes={platformSizes}
              selectedColor={selectedColor}
              onColorChange={setSelectedColor}
            />
            <div className="mt-6">
              <ProductAccordion description={product.description ?? ""} />
            </div>

            {/* Desktop reviews */}
            {/* <section className="mt-8">
              <h2 className="text-base font-semibold mb-4">Customer Reviews</h2>
              <ReviewList productId={product._id} />
            </section> */}
          </div>
        </div>
      </div>

      {/* ── YOU MAY ALSO LIKE carousel ──────────────────────── */}
      {recommendations.length > 0 && (
        <section className="w-full py-12 px-6 lg:px-10 my-24">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-xl font-semibold uppercase tracking-tight">
              You May Also Like
            </h2>
            <Link
              href="/products"
              className="text-xs font-medium text-muted-foreground hover:text-foreground uppercase tracking-wider transition-colors"
            >
              View All
            </Link>
          </div>
          <RecommendationCarousel products={recommendations} />
        </section>
      )}
    </>
  );
}
