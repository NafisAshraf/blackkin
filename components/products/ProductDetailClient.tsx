"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import MediaGallery from "@/components/products/MediaGallery";
import ProductInfo from "@/components/products/ProductInfo";
import ProductAccordion from "@/components/products/ProductAccordion";
import RecommendationCarousel from "@/components/products/RecommendationCarousel";
import ReviewList from "@/components/reviews/ReviewList";
import StickyAddToCartBar from "@/components/products/StickyAddToCartBar";
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
  commonMediaTopResolved: ResolvedMediaItem[];
  commonMediaBottomResolved: ResolvedMediaItem[];
  platformSizes: PlatformSize[];
  recommendations: Recommendation[];
}

// ─── Component ────────────────────────────────────────────────

export default function ProductDetailClient({
  product,
  thumbnailUrl,
  variantMediaResolved,
  commonMediaTopResolved,
  commonMediaBottomResolved,
  platformSizes,
  recommendations,
}: ProductDetailClientProps) {
  // Pre-select color from first available variant
  const initialColor =
    product.variants.find((v) => v.stock > 0)?.color ??
    product.variants[0]?.color ??
    null;
  const initialSize =
    product.variants.find((v) => v.stock > 0)?.size ??
    product.variants[0]?.size ??
    null;

  const [selectedColor, setSelectedColor] = useState<string | null>(
    initialColor,
  );
  const [selectedSize, setSelectedSize] = useState<string | null>(initialSize);

  // Ref attached to the Quantity+AddToCart section inside ProductInfo
  const addToCartRef = useRef<HTMLDivElement>(null);
  const productInfoRef = useRef<HTMLElement>(null);
  const [showStickyBar, setShowStickyBar] = useState(false);

  useEffect(() => {
    const target = addToCartRef.current;
    if (!target) return;
    const observer = new IntersectionObserver(
      ([entry]) => setShowStickyBar(!entry.isIntersecting),
      { threshold: 0 },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  const scrollToProductInfo = useCallback(() => {
    productInfoRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, []);

  // Compute active media for the selected color: commonTop + colorSpecific + commonBottom
  const activeVariantEntry = variantMediaResolved.find(
    (e) => e.color === selectedColor,
  );
  const colorMedia: ResolvedMediaItem[] = activeVariantEntry?.media ?? [];

  const allMediaCombined = [
    ...commonMediaTopResolved,
    ...colorMedia,
    ...commonMediaBottomResolved,
  ];

  const activeMedia: ResolvedMediaItem[] =
    allMediaCombined.length > 0
      ? allMediaCombined
      : thumbnailUrl
        ? [
            {
              storageId: "__thumbnail__",
              type: "image",
              sortOrder: 0,
              url: thumbnailUrl,
            },
          ]
        : [];

  return (
    <>
      {/* ── MOBILE layout: stacked ─────────────────────────── */}
      <div className="lg:hidden">
        <section className="w-full">
          <MediaGallery key={selectedColor ?? "none"} media={activeMedia} />
        </section>
        <section ref={productInfoRef} className="px-5 py-6 space-y-6">
          <ProductInfo
            product={product}
            platformSizes={platformSizes}
            selectedColor={selectedColor}
            onColorChange={setSelectedColor}
            selectedSize={selectedSize}
            onSizeChange={setSelectedSize}
            addToCartRef={addToCartRef}
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
          <MediaGallery key={selectedColor ?? "none"} media={activeMedia} />
        </div>

        {/* Right: sticky info column */}
        <div className="w-1/2 flex-shrink-0 px-10 pt-10">
          <div className="sticky top-[70px]">
            {/* Breadcrumb */}
            <nav className="text-xs text-muted-foreground flex items-center gap-1.5 flex-wrap mb-6">
              <Link
                href="/"
                className="hover:text-foreground transition-colors"
              >
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
              selectedSize={selectedSize}
              onSizeChange={setSelectedSize}
              addToCartRef={addToCartRef}
            />
            <div className="mt-6">
              <ProductAccordion description={product.description ?? ""} />
            </div>
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

      {/* ── STICKY ADD-TO-CART BAR ──────────────────────────── */}
      <StickyAddToCartBar
        product={{
          _id: product._id,
          name: product.name,
          effectivePrice: product.effectivePrice,
          variants: product.variants,
        }}
        thumbnailUrl={thumbnailUrl}
        selectedColor={selectedColor}
        selectedSize={selectedSize}
        visible={showStickyBar}
        onScrollToOptions={scrollToProductInfo}
      />
    </>
  );
}
