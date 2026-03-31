import { Suspense } from "react";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import ProductCarousel from "@/components/products/ProductCarousel";
import { fetchAuthQuery } from "@/lib/auth-server";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

export const metadata = {
  title: "Blackkin | Premium Comfort",
  description: "Shop premium undergarments. Crafted for lasting comfort and style.",
};

interface ProductMedia {
  storageId: Id<"_storage">;
  type: "image" | "video";
  sortOrder: number;
}

interface RawProduct {
  _id: Id<"products">;
  name: string;
  slug: string;
  basePrice: number;
  discountedPrice: number;
  discountAmount: number;
  campaignName: string | null;
  averageRating: number;
  totalRatings: number;
  media: ProductMedia[];
  tags?: Array<{ _id: string; name: string; slug: string }>;
}

async function withImageUrls(products: RawProduct[]) {
  const storageIds = products
    .map((p) => p.media[0]?.storageId)
    .filter((id): id is Id<"_storage"> => Boolean(id));

  const urls =
    storageIds.length > 0
      ? await fetchAuthQuery(api.files.getUrls, { storageIds })
      : [];

  const urlMap = new Map<string, string | null>();
  storageIds.forEach((id, index) => {
    urlMap.set(id as string, urls[index] ?? null);
  });

  return products.map((p) => ({
    ...p,
    imageUrl: p.media[0]?.storageId
      ? (urlMap.get(p.media[0].storageId as string) ?? null)
      : null,
  }));
}

export default async function HomePage() {
  const [rawBestSellers, rawNewArrivals] = await Promise.all([
    fetchAuthQuery(api.products.getFeaturedBestSellers, {}),
    fetchAuthQuery(api.products.getFeaturedNewArrivals, {}),
  ]);

  const [bestSellers, newArrivals] = await Promise.all([
    withImageUrls(rawBestSellers as RawProduct[]),
    withImageUrls(rawNewArrivals as RawProduct[]),
  ]);

  return (
    <div className="min-h-screen">
      <Navbar />

      {/* Hero Section */}
      <section className="relative w-full overflow-hidden bg-gray-100" style={{ minHeight: "90vh" }}>
        <div className="absolute inset-0">
          <img
            src="/hero-banner.png"
            alt="Blackkin Hero"
            className="w-full h-full object-cover object-center"
            style={{ objectPosition: "center top" }}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/30 to-transparent" />
        </div>
        <div className="relative z-10 h-full flex flex-col justify-end pb-16 px-8 lg:px-16" style={{ minHeight: "90vh" }}>
          <div className="max-w-xl">
            <p className="text-white/70 text-xs tracking-[0.3em] uppercase mb-4">Premium Comfort</p>
            <h1 className="text-white text-5xl md:text-7xl font-bold tracking-tight leading-none mb-6">
              BE<br />BOLD
            </h1>
            <Link
              href="/products"
              className="inline-block bg-white text-black text-xs font-semibold tracking-[0.2em] uppercase px-8 py-3.5 hover:bg-white/90 transition-colors"
            >
              Shop Now
            </Link>
          </div>
        </div>
      </section>

      {/* Tagline Section */}
      <section className="w-full py-16 px-6 lg:px-10 text-center border-b border-border">
        <p className="text-xs tracking-[0.3em] uppercase text-muted-foreground mb-3">Own the Moment</p>
        <h2 className="text-2xl md:text-4xl font-semibold tracking-tight">
          Comfort Meets Confidence
        </h2>
        <p className="mt-4 text-sm text-muted-foreground max-w-lg mx-auto">
          Engineered for the modern man. Premium fabrics, precision fit, lasting comfort.
        </p>
      </section>

      {/* Best Sellers */}
      <div className="border-b border-border">
        <Suspense fallback={<div className="py-24 text-center text-muted-foreground text-sm">Loading...</div>}>
          <ProductCarousel
            products={bestSellers}
            title="Best Sellers"
            viewAllHref="/products"
          />
        </Suspense>
      </div>

      {/* Lifestyle Banner */}
      <section className="w-full relative overflow-hidden bg-black" style={{ minHeight: "480px" }}>
        <img
          src="/lifestyle-banner.png"
          alt="Blackkin Lifestyle"
          className="w-full h-full object-cover absolute inset-0 opacity-60"
          style={{ minHeight: "480px" }}
        />
        <div className="relative z-10 flex flex-col items-center justify-center text-center text-white px-6 py-24 md:py-32" style={{ minHeight: "480px" }}>
          <p className="text-xs tracking-[0.4em] uppercase text-white/70 mb-4">Upgrade The Way You Feel</p>
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight leading-tight max-w-2xl">
            Designed for<br />
            <em className="not-italic text-white/80">Everyday</em> Heroes
          </h2>
          <Link
            href="/products"
            className="mt-8 inline-block border border-white text-white text-xs font-semibold tracking-[0.2em] uppercase px-8 py-3.5 hover:bg-white hover:text-black transition-colors"
          >
            Shop Collection
          </Link>
        </div>
      </section>

      {/* New Arrivals */}
      <div className="border-b border-border">
        <Suspense fallback={<div className="py-24 text-center text-muted-foreground text-sm">Loading...</div>}>
          <ProductCarousel
            products={newArrivals}
            title="New Arrivals"
            viewAllHref="/products?tag=new-arrivals"
          />
        </Suspense>
      </div>

      {/* Feature Highlight Grid */}
      <section className="w-full py-16 px-6 lg:px-10 border-b border-border">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-0.5">
          <div className="bg-[#f5f5f5] aspect-square flex flex-col items-center justify-center text-center px-8 py-12 gap-4">
            <div className="text-3xl">🧊</div>
            <h3 className="font-semibold tracking-wide text-sm uppercase">Ice Cool Fabric</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">Advanced cooling technology keeps you fresh all day long.</p>
          </div>
          <div className="bg-[#efefef] aspect-square flex flex-col items-center justify-center text-center px-8 py-12 gap-4">
            <div className="text-3xl">🛡️</div>
            <h3 className="font-semibold tracking-wide text-sm uppercase">Antibacterial</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">7A antibacterial protection for all-day hygiene confidence.</p>
          </div>
          <div className="bg-[#e8e8e8] aspect-square flex flex-col items-center justify-center text-center px-8 py-12 gap-4">
            <div className="text-3xl">⚡</div>
            <h3 className="font-semibold tracking-wide text-sm uppercase">Elastic Comfort</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">The bullet does not loosen — elasticity that lasts forever.</p>
          </div>
        </div>
      </section>

      {/* Premium Top Port Banner */}
      <section className="w-full py-16 px-6 lg:px-10 border-b border-border">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <div>
            <p className="text-xs tracking-[0.3em] uppercase text-muted-foreground mb-4">Premium Comfort</p>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight leading-tight mb-6">
              Premium Top Port<br />
              <span className="text-muted-foreground font-normal">for Every Body</span>
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-8">
              Engineered with cutting-edge fabric technology for an unparalleled wearing experience. Available in a full range of sizes to fit every man.
            </p>
            <Link
              href="/products"
              className="inline-block bg-foreground text-background text-xs font-semibold tracking-[0.2em] uppercase px-8 py-3.5 hover:opacity-90 transition-opacity"
            >
              Explore All
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-muted aspect-square" />
            <div className="bg-muted aspect-[4/5]" />
          </div>
        </div>
      </section>

      {/* Footer */}
      <Footer />
    </div>
  );
}
