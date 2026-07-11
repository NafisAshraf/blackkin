"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
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

interface GalleryJumpRequest {
  index: number;
  nonce: number;
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
  _id?: string;
  name: string;
  measurements?: string;
}

interface PlatformColor {
  name: string;
  hexCode: string;
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
  platformColors?: PlatformColor[];
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
  platformColors = [],
  recommendations,
}: ProductDetailClientProps) {
  const liveStock = useQuery(api.storefront.getProductStock, {
    productId: product._id,
  });
  const liveVariants = useMemo(() => {
    if (!liveStock) return product.variants;
    const stockByVariant = new Map(
      liveStock.map((item) => [String(item._id), item.stock]),
    );
    return product.variants.map((variant) => ({
      ...variant,
      stock: stockByVariant.get(String(variant._id)) ?? variant.stock,
    }));
  }, [liveStock, product.variants]);
  const liveProduct = useMemo(
    () => ({ ...product, variants: liveVariants }),
    [liveVariants, product],
  );

  // Pre-select color from first available variant
  const initialColor =
    liveProduct.variants.find((v) => v.stock > 0)?.color ??
    liveProduct.variants[0]?.color ??
    null;
  const initialSize =
    liveProduct.variants.find((v) => v.stock > 0)?.size ??
    liveProduct.variants[0]?.size ??
    null;

  const [selectedColor, setSelectedColor] = useState<string | null>(
    initialColor,
  );
  const [selectedSize, setSelectedSize] = useState<string | null>(initialSize);
  const [galleryJumpRequest, setGalleryJumpRequest] =
    useState<GalleryJumpRequest | null>(null);

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

  const allColors = Array.from(
    new Set(
      liveProduct.variants
        .map((v) => v.color)
        .filter((c): c is string => !!c),
    ),
  );
  const mediaByColor = new Map(
    variantMediaResolved.map((entry) => [entry.color, entry.media] as const),
  );
  const firstMediaIndexByColor: Record<string, number> = {};
  const allMediaCombined: ResolvedMediaItem[] = [];

  function appendMedia(items: ResolvedMediaItem[]) {
    for (const item of items) {
      allMediaCombined.push({ ...item, sortOrder: allMediaCombined.length });
    }
  }

  appendMedia(commonMediaTopResolved);
  for (const color of allColors) {
    const media = mediaByColor.get(color) ?? [];
    if (media.length > 0) {
      firstMediaIndexByColor[color] = allMediaCombined.length;
      appendMedia(media);
    }
  }
  appendMedia(commonMediaBottomResolved);

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

  function handleColorChange(
    color: string,
    options?: { jumpToMedia?: boolean },
  ) {
    setSelectedColor(color);
    if (!options?.jumpToMedia) return;

    const targetIndex = firstMediaIndexByColor[color];
    if (targetIndex === undefined) return;

    setGalleryJumpRequest((previous) => ({
      index: targetIndex,
      nonce: (previous?.nonce ?? 0) + 1,
    }));
  }

  return (
    <>
      {/* ── MOBILE layout: stacked ─────────────────────────── */}
      <div className="lg:hidden">
        <section className="w-full">
          <MediaGallery
            media={activeMedia}
            jumpRequest={galleryJumpRequest}
            posterUrl={thumbnailUrl}
            layout="mobile"
          />
        </section>
        <section ref={productInfoRef} className="px-5 py-6 space-y-6">
          <ProductInfo
            product={liveProduct}
            platformSizes={platformSizes}
            platformColors={platformColors}
            selectedColor={selectedColor}
            onColorChange={handleColorChange}
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
          <MediaGallery
            media={activeMedia}
            jumpRequest={galleryJumpRequest}
            posterUrl={thumbnailUrl}
            layout="desktop"
          />
        </div>

        {/* Right: sticky info column */}
        <div className="w-1/2 flex-shrink-0 px-10 pt-10">
          <div className="sticky top-[70px]">
            {/* Breadcrumb */}
            <nav className="text-xs text-muted-foreground flex items-center gap-1.5 flex-wrap mb-6">
              <Link
                href="/"
                prefetch={false}
                className="hover:text-foreground transition-colors"
              >
                Home
              </Link>
              <span>/</span>
              <Link
                href="/products"
                prefetch={false}
                className="hover:text-foreground transition-colors"
              >
                Products
              </Link>
              <span>/</span>
              <span className="text-foreground">{product.name}</span>
            </nav>

            <ProductInfo
              product={liveProduct}
              platformSizes={platformSizes}
              platformColors={platformColors}
              selectedColor={selectedColor}
              onColorChange={handleColorChange}
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
              prefetch={false}
              className="text-xs font-medium text-muted-foreground hover:text-foreground uppercase tracking-wider transition-colors"
            >
              View All
            </Link>
          </div>
          <RecommendationCarousel
            products={recommendations}
            colorHexMap={Object.fromEntries(
              platformColors.map((color) => [
                color.name.toLowerCase(),
                color.hexCode,
              ]),
            )}
          />
        </section>
      )}

      {/* ── STICKY ADD-TO-CART BAR ──────────────────────────── */}
      <StickyAddToCartBar
        product={{
          _id: liveProduct._id,
          name: liveProduct.name,
          effectivePrice: liveProduct.effectivePrice,
          variants: liveProduct.variants,
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
