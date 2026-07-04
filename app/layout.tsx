import type { Metadata } from "next";
import type { CSSProperties } from "react";
import "./globals.css";
import Script from "next/script";
import ConvexClientProvider from "@/components/ConvexClientProvider";
import { cn } from "@/lib/utils";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CartProvider } from "@/components/cart/CartProvider";
import { CartDrawer } from "@/components/cart/CartDrawer";
import { Toaster } from "@/components/ui/sonner";
import { MarketingScripts } from "@/components/MarketingScripts";

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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={cn("font-sans")}
      style={fontVariables}
    >
      <body className="antialiased">
        <ConvexClientProvider>
          <TooltipProvider>
            <CartProvider>
              {children}
              <CartDrawer />
              <Toaster />
              <MarketingScripts />
            </CartProvider>
          </TooltipProvider>
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
