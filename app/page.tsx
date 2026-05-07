import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { QuoteCarousel } from "@/components/QuoteCarousel";
import { ProductShowcase } from "@/components/ProductShowcase";
import { TechnologyCarousel } from "@/components/TechnologyCarousel";
import { fetchAuthQuery } from "@/lib/auth-server";
import { api } from "@/convex/_generated/api";

export const metadata = {
  title: "Blackkin | Premium Comfort",
  description:
    "Shop premium undergarments. Crafted for lasting comfort and style.",
};

export default async function HomePage() {
  // Fetch CMS content server-side. If Convex is unreachable, .catch returns null
  // so the landing page falls back to static defaults and never 500s.
  const content = await fetchAuthQuery(api.landingPage.getContent, {}).catch(
    () => null,
  );

  // Resolve each image URL, falling back to static public-folder images.
  const hero = content?.images.hero;
  const heroUrl = hero?.url || "/assets/hero.webm";
  const heroType = hero?.url ? hero.type : "video";

  const splitImage = content?.images.splitImage;
  const splitImageUrl = splitImage?.url || "/assets/featured.webm";
  const splitImageType = splitImage?.url ? splitImage.type : "video";
  const quotes = content?.quotes ?? [];

  // Dynamic product showcase sections (null-safe; only rendered when active & has products)
  const productSection1 =
    content?.productSections?.find((s) => s.position === 1) ?? null;
  const productSection2 =
    content?.productSections?.find((s) => s.position === 2) ?? null;

  return (
    <div className="min-h-screen">
      <Navbar />

      {/* Hero Section */}
      <section
        className="relative w-full overflow-hidden bg-gray-100"
        style={{ minHeight: "100vh" }}
      >
        <div className="absolute inset-0">
          {heroType === "video" ? (
            <video
              src={heroUrl}
              autoPlay
              loop
              muted
              playsInline
              disablePictureInPicture
              preload="auto"
              className="w-full h-full object-cover object-center"
              style={{ objectPosition: "center top" }}
            />
          ) : (
            <img
              src={heroUrl}
              alt="Blackkin Hero"
              className="w-full h-full object-cover object-center"
              style={{ objectPosition: "center top" }}
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/30 to-transparent" />
        </div>
        <div
          className="relative z-10 h-full flex items-center justify-center text-center px-6 md:px-12 lg:px-20"
          style={{ minHeight: "100vh" }}
        >
          <div className="flex flex-col items-center gap-8 md:gap-10 max-w-7xl">
            <div className="space-y-3 md:space-y-5">
              <h1
                className="hero-anim-1 text-white text-4xl md:text-6xl uppercase tracking-wider"
                style={{ fontFamily: "var(--font-anton)" }}
              >
                Bangladesh&apos;s Best Underwear
              </h1>
              <p className="hero-anim-2 text-white text-lg md:text-5xl font-serif uppercase opacity-90">
                With World Class Technology
              </p>
            </div>
            <Link
              href="/products"
              className="hero-anim-3 inline-block bg-white text-black text-xs md:text-sm  tracking-[0.1em] uppercase px-12 py-4 hover:bg-white/90 transition-all active:scale-95 shadow-xl"
            >
              Shop Now
            </Link>
          </div>
        </div>
      </section>

      {/* Product Showcase Section 1 — below "Crafted for the Modern Man" */}
      {productSection1 && productSection1.products.length > 0 && (
        <ProductShowcase
          heading={productSection1.heading}
          products={productSection1.products}
        />
      )}

      {/* Crafted for the Modern Man */}
      <section className="w-full py-24 md:py-32 px-6 text-center font-light h-[75vh] flex flex-col justify-center items-center">
        <div className="">
          <h2 className="text-3xl md:text-4xl lg:text-6xl">
            <span className="anim-on-scroll block text-[#111111] mb-5">
              CRAFTED FOR THE
            </span>
            <span className="anim-on-scroll anim-d2 block text-[#A3A3A3] mt-2">
              MODERN MAN.
            </span>
          </h2>
          <p className="anim-on-scroll anim-d4 mt-12 text-lg md:text-xl lg:text-3xl font-serif italic max-w-6xl mx-auto leading-relaxed tracking-wide ">
            "We Believe That What You Wear Closest To Your Skin Should Be Your
            Most Considered Choice."
          </p>
        </div>
      </section>

      {/* Sticky-parallax wrapper: Product Section 2 sticks while Split Section scrolls up over it */}
      <div className="relative ">
        {/* Product Showcase Section 2 — sticky so split section slides up over it */}
        <div className="sticky -top-15 z-0 mb-24">
          {productSection2 && productSection2.products.length > 0 && (
            <ProductShowcase
              heading={productSection2.heading}
              products={productSection2.products}
            />
          )}
        </div>

        {/* Split: Text Left / Image Right — slides up over the sticky product section */}
        <div className="relative z-10">
          <section className="w-full min-h-screen lg:h-screen grid grid-cols-1 lg:grid-cols-2 items-stretch">
            <div className="order-2 lg:order-1 bg-[#111111] flex flex-col justify-center items-center px-12 lg:px-20 py-16 h-full text-center">
              <h2 className="anim-on-scroll text-3xl md:text-4xl lg:text-5xl font-normal uppercase tracking-[0.1em] leading-[1.4] text-white">
                UPGRADE THE WAY
                <br />
                YOU FEEL, STARTING
                <br />
                WITH WHAT&apos;S
                <br />
                <span className="text-[#737373]">UNDERNEATH.</span>
              </h2>
              <Link
                href="/products"
                className="anim-on-scroll anim-d3 group mt-12 inline-block relative text-xs font-light tracking-[0.2em] uppercase text-white hover:text-white/60 transition-colors pb-1"
              >
                DISCOVER MORE
                <span className="sweep-underline absolute bottom-0 left-0 right-0 h-px bg-white" />
              </Link>
            </div>
            <div className="order-1 lg:order-2 relative h-full min-h-[50vh] lg:min-h-0">
              {splitImageType === "video" ? (
                <video
                  src={splitImageUrl}
                  autoPlay
                  loop
                  muted
                  playsInline
                  disablePictureInPicture
                  preload="auto"
                  className="w-full h-full object-cover object-center"
                />
              ) : (
                <img
                  src={splitImageUrl}
                  alt="Upgrade the way you feel"
                  className="w-full h-full object-cover object-center"
                />
              )}
              {/* Transparent overlay to block video interaction/context menu */}
              <div className="absolute inset-0 z-10" />
            </div>
          </section>
        </div>
      </div>

      {/* Premium Comfort Technology Carousel */}
      <TechnologyCarousel carousels={content?.carousels ?? []} />

      {/* Quotes Carousel — hidden if no quotes have been added yet */}
      <QuoteCarousel quotes={quotes} />

      {/* Footer */}
      <Footer />
    </div>
  );
}
