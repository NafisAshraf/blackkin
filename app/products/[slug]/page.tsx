import { notFound } from "next/navigation";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import MediaGallery from "@/components/products/MediaGallery";
import ProductInfo from "@/components/products/ProductInfo";
import ProductAccordion from "@/components/products/ProductAccordion";
import RecommendationCarousel from "@/components/products/RecommendationCarousel";
import ReviewList from "@/components/reviews/ReviewList";
import { fetchAuthQuery } from "@/lib/auth-server";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  const product = await fetchAuthQuery(api.products.getBySlug, { slug });
  return {
    title: product ? `${product.name} | Blackkin` : "Product | Blackkin",
    description:
      product?.description?.slice(0, 160) ??
      "Shop premium undergarments at Blackkin.",
  };
}

export default async function ProductDetailPage({ params }: PageProps) {
  const { slug } = await params;

  const [product, recommendations, platformSizes] = await Promise.all([
    fetchAuthQuery(api.products.getBySlug, { slug }),
    fetchAuthQuery(api.recommendations.getAlsoLike, {}),
    fetchAuthQuery(api.platformConfig.listSizes, {}),
  ]);

  if (!product) {
    notFound();
  }

  // Resolve media URLs
  const storageIds = product.media.map(
    (m: {
      storageId: string;
      type: "image" | "video" | "model3d";
      sortOrder: number;
    }) => m.storageId,
  );

  const mediaUrls =
    storageIds.length > 0
      ? await fetchAuthQuery(api.files.getUrls, { storageIds })
      : [];

  const resolvedMedia = product.media.map(
    (
      m: {
        storageId: string;
        type: "image" | "video" | "model3d";
        sortOrder: number;
      },
      index: number,
    ) => ({
      ...m,
      url: mediaUrls[index] ?? null,
    }),
  );

  type Recommendation = {
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
    tags?: Array<{ _id: string; name: string; slug: string }>;
    variants?: Array<{ color?: string }>;
  };

  const typedRecommendations = (recommendations ?? []) as Recommendation[];

  return (
    <div className="min-h-screen">
      <Navbar />

      {/* ── MOBILE layout: stacked ─────────────────────────── */}
      <div className="lg:hidden">
        <section className="w-full">
          <MediaGallery media={resolvedMedia} />
        </section>
        <section className="px-5 py-6 space-y-6">
          <ProductInfo product={product} platformSizes={platformSizes ?? []} />
          <ProductAccordion description={product.description ?? ""} />

          {/* Mobile reviews */}
          <section>
            <h2 className="text-base font-semibold mb-4">Customer Reviews</h2>
            <ReviewList productId={product._id} />
          </section>
        </section>
      </div>

      {/* ── DESKTOP layout: 50/50 sticky ───────────────────── */}
      <div className="hidden lg:flex w-full">
        {/* Left: media stack (scrollable with page, takes natural height) */}
        <div className="w-1/2 flex-shrink-0">
          <MediaGallery media={resolvedMedia} />
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
              platformSizes={platformSizes ?? []}
            />
            <div className="mt-6">
              <ProductAccordion description={product.description ?? ""} />
            </div>

            {/* Desktop reviews */}
            <section className="mt-8">
              <h2 className="text-base font-semibold mb-4">Customer Reviews</h2>
              <ReviewList productId={product._id} />
            </section>
          </div>
        </div>
      </div>

      {/* ── YOU MAY ALSO LIKE carousel ──────────────────────── */}
      {typedRecommendations.length > 0 && (
        <section className="w-full py-12 px-6 lg:px-10 border-t border-border mt-8">
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
          <RecommendationCarousel products={typedRecommendations} />
        </section>
      )}

      <Footer />
    </div>
  );
}
