import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { QuoteCarousel } from "@/components/QuoteCarousel";
import { ProductShowcase } from "@/components/ProductShowcase";
import { fetchAuthQuery } from "@/lib/auth-server";
import { api } from "@/convex/_generated/api";

export const metadata = {
  title: "Blackkin | Premium Comfort",
  description: "Shop premium undergarments. Crafted for lasting comfort and style.",
};

export default async function HomePage() {
  // Fetch CMS content server-side. If Convex is unreachable, .catch returns null
  // so the landing page falls back to static defaults and never 500s.
  const content = await fetchAuthQuery(api.landingPage.getContent, {}).catch(() => null);

  // Resolve each image URL, falling back to static public-folder images.
  const heroSrc = content?.images.hero ?? "/hero-banner.png";
  const splitImageSrc = content?.images.splitImage ?? "/lifestyle-banner.png";
  const tech1Src = content?.images.tech1 ?? "/3imagesection1.png";
  const tech2Src = content?.images.tech2 ?? "/3imagesection2.png";
  const tech3Src = content?.images.tech3 ?? "/3imagesection3.png";
  const quotes = content?.quotes ?? [];

  // Dynamic product showcase sections (null-safe; only rendered when active & has products)
  const productSection1 = content?.productSections?.find((s) => s.position === 1) ?? null;
  const productSection2 = content?.productSections?.find((s) => s.position === 2) ?? null;

  return (
    <div className="min-h-screen">
      <Navbar />

      {/* Hero Section */}
      <section className="relative w-full overflow-hidden bg-gray-100" style={{ minHeight: "90vh" }}>
        <div className="absolute inset-0">
          <img
            src={heroSrc}
            alt="Blackkin Hero"
            className="w-full h-full object-cover object-center"
            style={{ objectPosition: "center top" }}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/30 to-transparent" />
        </div>
        <div className="relative z-10 h-full flex flex-col justify-end pb-16 px-6 md:px-12 lg:px-20" style={{ minHeight: "90vh" }}>
          <div className="flex flex-col md:flex-row md:justify-between md:items-end w-full gap-8">
            <div className="flex flex-col">
              <img
                src="/assets/blackkin_text.svg"
                alt="Blackkin"
                className="h-10 md:h-16 lg:h-20 w-auto object-contain object-left mb-2 md:mb-4 brightness-0 invert"
              />
              <h1 className="text-white text-6xl md:text-8xl lg:text-[110px] tracking-tight leading-none uppercase">
                <span className="font-light">BE</span> <span className="font-semibold">BOLD</span>
              </h1>
            </div>
            <Link
              href="/products"
              className="inline-block bg-white text-black text-xs font-semibold tracking-[0.2em] uppercase px-10 py-4 hover:bg-white/90 transition-colors mb-2 lg:mb-6"
            >
              Explore Store
            </Link>
          </div>
        </div>
      </section>

      {/* Crafted for the Modern Man */}
      <section className="w-full py-24 md:py-32 px-6 text-center border-b border-border">
        <h2 className="text-3xl md:text-4xl lg:text-5xl font-light tracking-[0.15em] uppercase leading-tight">
          <span className="block text-[#111111]">CRAFTED FOR THE</span>
          <span className="block text-[#A3A3A3] mt-2">MODERN MAN.</span>
        </h2>
        <p className="mt-12 text-lg md:text-xl lg:text-2xl font-serif italic text-black max-w-4xl mx-auto leading-relaxed tracking-wide">
          "We Believe That What You Wear Closest To Your Skin Should Be Your Most Considered Choice."
        </p>
      </section>

      {/* Product Showcase Section 1 — below "Crafted for the Modern Man" */}
      {productSection1 && productSection1.products.length > 0 && (
        <ProductShowcase
          heading={productSection1.heading}
          products={productSection1.products}
        />
      )}

      {/* Split: Text Left / Image Right */}
      <section className="w-full h-screen grid grid-cols-1 lg:grid-cols-2">
        <div className="bg-[#111111] flex flex-col justify-center items-center px-12 lg:px-20 py-16 h-full text-center">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-normal uppercase tracking-[0.1em] leading-[1.4] text-white">
            UPGRADE THE WAY<br />
            YOU FEEL, STARTING<br />
            WITH WHAT&apos;S<br />
            <span className="text-[#737373]">UNDERNEATH.</span>
          </h2>
          <Link
            href="/products"
            className="mt-12 inline-block text-xs font-light tracking-[0.2em] uppercase text-white hover:text-white/60 transition-colors border-b border-white pb-1"
          >
            DISCOVER MORE
          </Link>
        </div>
        <div className="relative h-full min-h-[50vh] lg:min-h-0">
          <img
            src={splitImageSrc}
            alt="Upgrade the way you feel"
            className="w-full h-full object-cover object-center"
          />
        </div>
      </section>

      {/* Product Showcase Section 2 — below the split section */}
      {productSection2 && productSection2.products.length > 0 && (
        <ProductShowcase
          heading={productSection2.heading}
          products={productSection2.products}
        />
      )}

      {/* Premium Comfort Technology */}
      <section className="w-full bg-white border-t border-border">
        {/* Section Header */}
        <div className="text-center py-16 px-6">
          <h2 className="text-4xl md:text-5xl font-thin tracking-[0.22em] uppercase leading-snug">
            <span className="block text-foreground">Premium Comfort</span>
            <span className="block text-gray-300">Technology</span>
          </h2>
        </div>

        {/* 3-Image Grid */}
        <div className="grid grid-cols-3 w-full">
          {/* Image 1 */}
          <div className="flex flex-col">
            <div className="w-full aspect-[3/4] overflow-hidden">
              <img
                src={tech1Src}
                alt="Graphene Antibacterial Inner Crotch"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="py-5 px-4 text-center bg-white">
              <p className="text-sm text-foreground tracking-wide">Graphene Antibacterial Inner Crotch</p>
              <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                Wicks away moisture, dries quickly and keep you dry all day long.
              </p>
              <Link
                href="/products"
                className="mt-2 inline-block text-xs tracking-[0.2em] uppercase underline underline-offset-2 text-foreground hover:text-muted-foreground transition-colors"
              >
                Discover More
              </Link>
            </div>
          </div>

          {/* Image 2 */}
          <div className="flex flex-col">
            <div className="w-full aspect-[3/4] overflow-hidden">
              <img
                src={tech2Src}
                alt="Dynamic Stretch"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="py-5 px-4 text-center bg-white">
              <p className="text-sm text-foreground tracking-wide">Dynamic Stretch</p>
              <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                4-way stretch fabric that moves with you, never against you.
              </p>
              <Link
                href="/products"
                className="mt-2 inline-block text-xs tracking-[0.2em] uppercase underline underline-offset-2 text-foreground hover:text-muted-foreground transition-colors"
              >
                Discover More
              </Link>
            </div>
          </div>

          {/* Image 3 */}
          <div className="flex flex-col">
            <div className="w-full aspect-[3/4] overflow-hidden">
              <img
                src={tech3Src}
                alt="Wormwood Essential Oil Care"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="py-5 px-4 text-center bg-white">
              <p className="text-sm text-foreground tracking-wide">Wormwood Essential Oil Care</p>
              <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                7A Grade antibacterial and deodorizing.
              </p>
              <Link
                href="/products"
                className="mt-2 inline-block text-xs tracking-[0.2em] uppercase underline underline-offset-2 text-foreground hover:text-muted-foreground transition-colors"
              >
                Discover More
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Quotes Carousel — hidden if no quotes have been added yet */}
      <QuoteCarousel quotes={quotes} />

      {/* Footer */}
      <Footer />
    </div>
  );
}
