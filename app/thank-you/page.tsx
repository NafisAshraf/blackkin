"use client";

import Link from "next/link";
import { CheckCircle2, Home, PackageSearch } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";

export default function ThankYouPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="min-h-[70vh] px-6 py-20 flex items-center justify-center">
        <section className="w-full max-w-2xl text-center space-y-8">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-foreground/10 bg-foreground text-background">
            <CheckCircle2 className="h-8 w-8" aria-hidden="true" />
          </div>

          <div className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground">
              Order Received
            </p>
            <h1 className="text-4xl md:text-6xl font-semibold tracking-normal">
              Thank you for your purchase.
            </h1>
            <p className="mx-auto max-w-xl text-sm md:text-base leading-7 text-muted-foreground">
              We appreciate your order. You can check product and delivery
              updates from your orders page anytime.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button asChild className="w-full sm:w-auto gap-2">
              <Link href="/account/orders">
                <PackageSearch className="h-4 w-4" aria-hidden="true" />
                See order updates
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="w-full sm:w-auto gap-2"
            >
              <Link href="/">
                <Home className="h-4 w-4" aria-hidden="true" />
                Back home
              </Link>
            </Button>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
