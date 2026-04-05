import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { QuoteCarousel } from "@/components/QuoteCarousel";
import { fetchAuthQuery } from "@/lib/auth-server";
import { api } from "@/convex/_generated/api";

export const metadata = {
  title: "Blackkin | Premium Comfort",
  description: "Shop premium undergarments. Crafted for lasting comfort and style.",
};

export default async function HomePage() {
  // Fetch CMS content server-side. Falls back gracefully if DB has no entries yet.
  const content = await fetchAuthQuery(api.landingPage.getContent, {});

  // Resolve each image URL, falling back to static public-folder images.
  const heroSrc          = content.images.hero           ?? "/hero-banner.png";
  const lifestyleSrc     = content.images.lifestyleBanner ?? "/lifestyle-banner.png";
  const splitImageSrc    = content.images.splitImage      ?? "/lifestyle-banner.png";
  const tech1Src         = content.images.tech1           ?? "/3imagesection1.png";
  const tech2Src         = content.images.tech2           ?? "/3imagesection2.png";
  const tech3Src         = content.images.tech3           ?? "/3imagesection3.png";

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

      {/* Crafted for the Modern Man */}
      <section className="w-full py-24 md:py-32 px-6 text-center border-b border-border">
        <h2 className="text-4xl md:text-6xl font-thin tracking-[0.22em] uppercase leading-snug">
          <span className="block text-foreground">Crafted for the</span>
          <span className="block text-gray-300">Modern Man.</span>
        </h2>
        <p className="mt-10 text-sm italic text-muted-foreground max-w-xl mx-auto leading-relaxed">
          &ldquo;We Believe That What You Wear Closest To Your Skin Should Be Your Most Considered Choice.&rdquo;
        </p>
      </section>

      {/* Lifestyle Banner */}
      <section className="w-full h-screen relative overflow-hidden bg-black">
        <img
          src={lifestyleSrc}
          alt="Blackkin Lifestyle"
          className="w-full h-full object-cover absolute inset-0 opacity-60"
        />
        <div className="relative z-10 h-full flex flex-col items-center justify-center text-center text-white px-6">
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

      {/* Split: Text Left / Image Right */}
      <section className="w-full h-screen grid grid-cols-1 lg:grid-cols-2">
        <div className="bg-[#111111] flex flex-col justify-center px-12 lg:px-20 py-16 h-full">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold uppercase tracking-[0.06em] leading-tight text-white">
            Upgrade the way<br />
            you feel, starting<br />
            with what&apos;s<br />
            <span className="text-white/40">Underneath</span>
            <span className="text-white">.</span>
          </h2>
          <Link
            href="/products"
            className="mt-8 inline-block text-xs tracking-[0.25em] uppercase text-white underline underline-offset-4 hover:text-white/60 transition-colors w-fit"
          >
            Discover More
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
      <QuoteCarousel quotes={content.quotes} />

      {/* Footer */}
      <Footer />
    </div>
  );
}
