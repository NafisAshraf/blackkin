import { notFound } from "next/navigation";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import MediaGallery from "@/components/products/MediaGallery";
import ProductInfo from "@/components/products/ProductInfo";
import ProductAccordion from "@/components/products/ProductAccordion";
import ProductCard from "@/components/products/ProductCard";
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
    (m: { storageId: Id<"_storage">; type: "image" | "video" | "model3d"; sortOrder: number }) =>
      m.storageId
  );

  const mediaUrls =
    storageIds.length > 0
      ? await fetchAuthQuery(api.files.getUrls, { storageIds })
      : [];

  const resolvedMedia = product.media.map(
    (
      m: { storageId: Id<"_storage">; type: "image" | "video" | "model3d"; sortOrder: number },
      index: number
    ) => ({
      ...m,
      url: mediaUrls[index] ?? null,
    })
  );

  // Resolve recommendation URLs
  const recStorageIds = (
    recommendations as Array<{
      _id: Id<"products">;
      name: string;
      slug: string;
      basePrice: number;
      effectivePrice: number;
      discountAmount: number;
      discountGroupName: string | null;
      averageRating: number;
      totalRatings: number;
      imageUrl: string | null;
      tags?: Array<{ _id: string; name: string; slug: string }>;
    }>
  )
    ?.map((r) => r.imageUrl)
    .filter(Boolean) ?? [];

  return (
    <div className="min-h-screen">
      <Navbar />

      {/* ── MAIN PRODUCT SECTION ── */}
      {/* Mobile layout: stacked */}
      <div className="md:hidden">
        <section className="w-full">
          <MediaGallery media={resolvedMedia} />
        </section>
        <section className="px-5 py-6 space-y-6">
          <ProductInfo product={product} platformSizes={platformSizes ?? []} />
          <ProductAccordion description={product.description ?? ""} />
        </section>
      </div>

      {/* Desktop layout: sticky left column */}
      <div className="hidden md:flex w-full" style={{ minHeight: "100vh" }}>
        {/* Left Column — sticky, fills viewport height, scrolls internally */}
        <div
          className="pdp-left-column"
          style={{ width: "55%", minWidth: "55%" }}
        >
          <MediaGallery media={resolvedMedia} />
        </div>

        {/* Right Column — scrolls with the page */}
        <div
          className="flex-1 px-10 py-10 space-y-8"
          style={{ minWidth: 0 }}
        >
          {/* Breadcrumb */}
          <nav className="text-xs text-muted-foreground flex items-center gap-1.5 flex-wrap">
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

          <ProductInfo product={product} platformSizes={platformSizes ?? []} />
          <ProductAccordion description={product.description ?? ""} />

          {/* Reviews */}
          <section>
            <h2 className="text-base font-semibold mb-4">Customer Reviews</h2>
            <ReviewList productId={product._id} />
          </section>
        </div>
      </div>

      {/* ── BELOW THE FOLD ── */}
      {/* You May Also Like */}
      {recommendations && recommendations.length > 0 && (
        <section className="w-full py-12 px-6 lg:px-10 border-t border-border">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-xl font-semibold uppercase tracking-tight">
              You May Also Like
            </h2>
            <Link
              href="/products"
              className="text-xs font-medium text-muted-foreground hover:text-foreground uppercase tracking-wider transition-colors"
            >
              View All Products
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
            {(
              recommendations as Array<{
                _id: Id<"products">;
                name: string;
                slug: string;
                basePrice: number;
                effectivePrice: number;
                discountAmount: number;
                discountGroupName: string | null;
                averageRating: number;
                totalRatings: number;
                imageUrl: string | null;
                tags?: Array<{ _id: string; name: string; slug: string }>;
              }>
            ).map((rec) => (
              <ProductCard
                key={rec._id}
                product={{
                  _id: rec._id,
                  name: rec.name,
                  slug: rec.slug,
                  basePrice: rec.basePrice,
                  effectivePrice: rec.effectivePrice,
                  discountAmount: rec.discountAmount,
                  discountGroupName: rec.discountGroupName,
                  averageRating: rec.averageRating,
                  totalRatings: rec.totalRatings,
                  media: [],
                  tags: rec.tags,
                }}
                imageUrl={rec.imageUrl}
              />
            ))}
          </div>
        </section>
      )}

      {/* Mobile: Customer Reviews */}
      <div className="md:hidden px-5 pb-8 border-t border-border">
        <h2 className="text-base font-semibold mt-6 mb-4">Customer Reviews</h2>
        <ReviewList productId={product._id} />
      </div>

      <Footer />
    </div>
  );
}
