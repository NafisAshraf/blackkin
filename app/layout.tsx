import type { Metadata } from "next";
import type { CSSProperties } from "react";
import "./globals.css";
import Script from "next/script";
import ConvexClientProvider from "@/components/ConvexClientProvider";
import { cn } from "@/lib/utils";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CartProvider } from "@/components/cart/CartProvider";
import { LazyCartDrawer } from "@/components/cart/LazyCartDrawer";
import { Toaster } from "@/components/ui/sonner";
import { MarketingScripts } from "@/components/MarketingScripts";
import { resolveProductCardMedia } from "@/lib/storefront-media";
import { getStorefrontShell } from "@/lib/storefront-cache";
import {
  StorefrontDataProvider,
  type StorefrontShellData,
} from "@/contexts/StorefrontDataContext";

const fontVariables = {
  "--font-sans": 'Montserrat, "Helvetica Neue", Arial, sans-serif',
  "--font-serif": 'Georgia, "Times New Roman", serif',
  "--font-geist-sans": '"Segoe UI", Arial, sans-serif',
  "--font-geist-mono": '"Cascadia Code", Consolas, monospace',
  "--font-anton": 'Impact, "Arial Black", sans-serif',
} as CSSProperties;

export const metadata: Metadata = {
  title: {
    template: "%s | Blackkin",
    default: "Blackkin — Premium Essentials",
  },
  description: "Premium quality underwear and everyday essentials.",
  openGraph: {
    siteName: "Blackkin",
    type: "website",
  },
  icons: {
    icon: "/assets/blackkin_logo_white.svg",
    shortcut: "/assets/blackkin_logo_white.svg",
    apple: "/assets/blackkin_logo_white.svg",
  },
};

export const revalidate = 900;

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const shell = await getStorefrontShell().catch(() => null);
  const storefrontData: StorefrontShellData = shell
    ? {
        navigation: shell.navigation.map((item) => ({
          ...item,
          _id: String(item._id),
          categoryId: String(item.categoryId),
        })),
        categories: shell.categories.map((category) => ({
          ...category,
          _id: String(category._id),
        })),
        predefinedQueries: shell.predefinedQueries.map((query) => ({
          ...query,
          _id: String(query._id),
        })),
        searchProducts: shell.searchProducts.map((product) => {
          const resolved = resolveProductCardMedia(product);
          return {
            _id: String(product._id),
            name: product.name,
            slug: product.slug,
            description: product.description,
            basePrice: product.basePrice,
            effectivePrice: product.effectivePrice,
            discountAmount: product.discountAmount,
            imageUrl: resolved.imageUrl,
          };
        }),
        marketing: shell.marketing,
      }
    : {
        navigation: [],
        categories: [],
        predefinedQueries: [],
        searchProducts: [],
        marketing: {
          facebookPixelId: null,
          facebookBrowserEnabled: false,
          ga4MeasurementId: null,
          googleEnabled: false,
          headScripts: null,
          bodyScripts: null,
        },
      };

  return (
    <html
      lang="en"
      className={cn("font-sans")}
      style={fontVariables}
    >
      <body className="antialiased">
        <ConvexClientProvider>
          <StorefrontDataProvider data={storefrontData}>
            <TooltipProvider>
              <CartProvider>
                {children}
                <LazyCartDrawer />
                <Toaster />
                <MarketingScripts />
              </CartProvider>
            </TooltipProvider>
          </StorefrontDataProvider>
        </ConvexClientProvider>
        <Script id="scroll-anim" strategy="afterInteractive">{`
          (function() {
            var io = new IntersectionObserver(function(entries) {
              entries.forEach(function(e) {
                if (e.isIntersecting) {
                  e.target.classList.add('is-visible');
                  io.unobserve(e.target);
                }
              });
            }, { threshold: 0.12 });

            function observeAll() {
              document.querySelectorAll('.anim-on-scroll:not(.is-visible)').forEach(function(el) {
                io.observe(el);
              });
            }

            // Watch for newly-added .anim-on-scroll nodes (SPA navigation / dynamic content)
            var mo = new MutationObserver(function(mutations) {
              mutations.forEach(function(m) {
                m.addedNodes.forEach(function(node) {
                  if (node.nodeType !== 1) return;
                  if (node.classList && node.classList.contains('anim-on-scroll') && !node.classList.contains('is-visible')) {
                    io.observe(node);
                  }
                  node.querySelectorAll && node.querySelectorAll('.anim-on-scroll:not(.is-visible)').forEach(function(el) {
                    io.observe(el);
                  });
                });
              });
            });

            function init() {
              observeAll();
              mo.observe(document.body, { childList: true, subtree: true });
            }

            if (document.readyState === 'loading') {
              document.addEventListener('DOMContentLoaded', init);
            } else {
              init();
            }
          })();
        `}</Script>
      </body>
    </html>
  );
}
