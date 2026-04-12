import type { Metadata } from "next";
import { Geist, Geist_Mono, Montserrat } from "next/font/google";
import "./globals.css";
import ConvexClientProvider from "@/components/ConvexClientProvider";
import { cn } from "@/lib/utils";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CartProvider } from "@/components/cart/CartProvider";
import { CartDrawer } from "@/components/cart/CartDrawer";
import { Toaster } from "@/components/ui/sonner";
import { MarketingScripts } from "@/components/MarketingScripts";

const montserrat = Montserrat({ subsets: ["latin"], variable: "--font-sans" });

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    template: "%s | Blackkin",
    default: "Blackkin — Premium Essentials",
  },
  description:
    "Premium quality underwear and everyday essentials. Free shipping on orders above ৳999.",
  openGraph: {
    siteName: "Blackkin",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={cn("font-sans", montserrat.variable)}>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
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
      </body>
    </html>
  );
}
