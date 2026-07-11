import { cache } from "react";
import { notFound } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import ProductDetailClient from "@/components/products/ProductDetailClient";
import { getPublicMediaUrl } from "@/lib/public-media";
import { resolveProductCardMedia } from "@/lib/storefront-media";
import {
  getStorefrontProduct,
  getStorefrontProductSlugs,
} from "@/lib/storefront-cache";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export const revalidate = 900;
export const dynamicParams = true;

const getProductPageData = cache(getStorefrontProduct);

export async function generateStaticParams() {
  return await getStorefrontProductSlugs();
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  const data = await getProductPageData(slug);
  if (!data) return { title: "Product" };

  return {
    title: data.product.metaTitle || data.product.name,
    description:
      data.product.metaDescription || data.product.description.slice(0, 160),
    openGraph: {
      title: data.product.metaTitle || data.product.name,
      description:
        data.product.metaDescription || data.product.description.slice(0, 160),
      images: data.product.thumbnailStorageId
        ? [getPublicMediaUrl(data.product.thumbnailStorageId)!]
        : [],
    },
  };
}

export default async function ProductDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const data = await getProductPageData(slug);
  if (!data) notFound();

  const product = data.product;
  const thumbnailUrl = getPublicMediaUrl(product.thumbnailStorageId);
  const variantMediaResolved = product.variantMedia.map((entry) => ({
    color: entry.color,
    media: [...entry.media]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((item) => ({ ...item, url: getPublicMediaUrl(item.storageId) })),
  }));
  const commonMediaTopResolved = [...(product.commonMediaTop ?? [])]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((item) => ({ ...item, url: getPublicMediaUrl(item.storageId) }));
  const commonMediaBottomResolved = [...(product.commonMediaBottom ?? [])]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((item) => ({ ...item, url: getPublicMediaUrl(item.storageId) }));
  const recommendations = data.recommendations.map((recommendation) =>
    resolveProductCardMedia(recommendation),
  );

  return (
    <div className="min-h-screen">
      <Navbar />
      <ProductDetailClient
        product={product}
        thumbnailUrl={thumbnailUrl}
        variantMediaResolved={variantMediaResolved}
        commonMediaTopResolved={commonMediaTopResolved}
        commonMediaBottomResolved={commonMediaBottomResolved}
        platformSizes={data.sizes}
        platformColors={data.colors}
        recommendations={recommendations}
      />
      <Footer />
    </div>
  );
}
