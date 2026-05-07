import { notFound } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import ProductDetailClient from "@/components/products/ProductDetailClient";
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

  // Collect all storageIds: thumbnail + hoverThumbnail + commonMediaTop + commonMediaBottom + all variantMedia items
  const allStorageIds: string[] = [];
  if (product.thumbnailStorageId) {
    allStorageIds.push(product.thumbnailStorageId);
  }
  if (product.hoverThumbnailStorageId) {
    allStorageIds.push(product.hoverThumbnailStorageId);
  }
  const variantMedia: Array<{
    color: string;
    media: Array<{
      storageId: string;
      type: "image" | "video" | "model3d";
      sortOrder: number;
    }>;
  }> = product.variantMedia ?? [];
  const commonMediaTop: Array<{
    storageId: string;
    type: "image" | "video" | "model3d";
    sortOrder: number;
  }> = (product.commonMediaTop as typeof commonMediaTop) ?? [];
  const commonMediaBottom: Array<{
    storageId: string;
    type: "image" | "video" | "model3d";
    sortOrder: number;
  }> = (product.commonMediaBottom as typeof commonMediaBottom) ?? [];
  for (const item of commonMediaTop) allStorageIds.push(item.storageId);
  for (const item of commonMediaBottom) allStorageIds.push(item.storageId);
  for (const entry of variantMedia) {
    for (const item of entry.media) {
      allStorageIds.push(item.storageId);
    }
  }

  const allUrls =
    allStorageIds.length > 0
      ? await fetchAuthQuery(api.files.getUrls, { storageIds: allStorageIds })
      : [];

  // Build URL map
  const urlMap: Record<string, string | null> = {};
  allStorageIds.forEach((id, i) => {
    urlMap[id] = allUrls[i] ?? null;
  });

  const thumbnailUrl = product.thumbnailStorageId
    ? (urlMap[product.thumbnailStorageId] ?? null)
    : null;

  const variantMediaResolved = variantMedia.map((entry) => ({
    color: entry.color,
    media: entry.media
      .map((item) => ({ ...item, url: urlMap[item.storageId] ?? null }))
      .sort((a, b) => a.sortOrder - b.sortOrder),
  }));

  const commonMediaTopResolved = [...commonMediaTop]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((item) => ({ ...item, url: urlMap[item.storageId] ?? null }));

  const commonMediaBottomResolved = [...commonMediaBottom]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((item) => ({ ...item, url: urlMap[item.storageId] ?? null }));

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
    colorFirstImageUrls: Array<{ color: string; url: string | null }>;
    tags?: Array<{ _id: string; name: string; slug: string }>;
    variants?: Array<{ color?: string }>;
  };

  const typedRecommendations = (recommendations ?? []) as Recommendation[];

  return (
    <div className="min-h-screen">
      <Navbar />

      <ProductDetailClient
        product={product}
        thumbnailUrl={thumbnailUrl}
        variantMediaResolved={variantMediaResolved}
        commonMediaTopResolved={commonMediaTopResolved}
        commonMediaBottomResolved={commonMediaBottomResolved}
        platformSizes={platformSizes ?? []}
        recommendations={typedRecommendations}
      />

      <Footer />
    </div>
  );
}
