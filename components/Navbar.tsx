"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { authClient } from "@/lib/auth-client";
import { CartIcon } from "@/components/cart/CartIcon";
import { Heart, Search, User, X, Menu } from "lucide-react";

export function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session } = authClient.useSession();

  // Don't render navbar on admin pages
  if (pathname?.startsWith("/admin")) return null;

  return <NavbarInner />;
}

function NavbarInner() {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session, isPending } = authClient.useSession();

  const [announcementDismissed, setAnnouncementDismissed] = useState(false);
  const [navVisible, setNavVisible] = useState(true);
  const [atTop, setAtTop] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const lastScrollY = useRef(0);
  const ticking = useRef(false);

  const handleScroll = useCallback(() => {
    if (ticking.current) return;
    ticking.current = true;

    requestAnimationFrame(() => {
      const currentScrollY = window.scrollY;
      const isAtTop = currentScrollY < 10;

      setAtTop(isAtTop);

      if (isAtTop) {
        setNavVisible(true);
      } else if (currentScrollY > lastScrollY.current && currentScrollY > 80) {
        // Scrolling down
        setNavVisible(false);
      } else if (currentScrollY < lastScrollY.current) {
        // Scrolling up
        setNavVisible(true);
      }

      lastScrollY.current = currentScrollY;
      ticking.current = false;
    });
  }, []);

  useEffect(() => {
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  const showAnnouncement = !announcementDismissed && atTop;
  const announcementHeight = showAnnouncement ? 36 : 0;

  const loginHref =
    pathname && pathname !== "/login" && pathname !== "/register"
      ? `/login?next=${encodeURIComponent(pathname)}`
      : "/login";

  return (
    <>
      {/* Spacer to prevent content jump */}
      <div style={{ height: `${announcementHeight + 56}px` }} />

      <div
        className="navbar-wrapper fixed top-0 left-0 right-0 z-50"
        style={{
          transform: navVisible ? "translateY(0)" : "translateY(-100%)",
        }}
      >
        {/* Announcement Bar */}
        {!announcementDismissed && (
          <div
            className="bg-black text-white overflow-hidden relative"
            style={{
              height: atTop ? "36px" : "0px",
              transition: "height 0.3s ease",
            }}
          >
            <div className="announcement-marquee whitespace-nowrap items-center h-full">
              {[...Array(2)].map((_, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-12 px-6 text-xs tracking-[0.2em] uppercase h-full"
                >
                  <span>Be Bold</span>
                  <span>·</span>
                  <span>Premium Comfort</span>
                  <span>·</span>
                  <span>Free Shipping Over ৳999</span>
                  <span>·</span>
                  <span>Be Bold</span>
                  <span>·</span>
                  <span>Premium Comfort</span>
                  <span>·</span>
                  <span>Free Shipping Over ৳999</span>
                  <span>·</span>
                  <span>Be Bold</span>
                  <span>·</span>
                  <span>Premium Comfort</span>
                  <span>·</span>
                  <span>Free Shipping Over ৳999</span>
                  <span className="pl-12" />
                </span>
              ))}
            </div>
            <button
              onClick={() => setAnnouncementDismissed(true)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/70 hover:text-white transition-colors"
              aria-label="Dismiss announcement"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Main Navbar */}
        <header className="bg-white border-b border-border">
          <div className="w-full px-6 lg:px-10 h-14 flex items-center justify-between">
            {/* Left: Nav Links (desktop) / Hamburger (mobile) */}
            <div className="flex items-center gap-8">
              <button
                className="md:hidden"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                aria-label="Toggle menu"
              >
                <Menu className="h-5 w-5" />
              </button>
              <nav className="hidden md:flex items-center gap-6 text-xs font-medium tracking-wide uppercase">
                <Link
                  href="/products"
                  className={`hover:text-foreground transition-colors ${
                    pathname === "/products"
                      ? "text-foreground"
                      : "text-muted-foreground"
                  }`}
                >
                  Catalog
                </Link>
                <Link
                  href="/products?tag=new-arrivals"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  New Arrivals
                </Link>
                <Link
                  href="/products?tag=sale"
                  className="text-red-500 hover:text-red-600 font-semibold transition-colors"
                >
                  Sale 🔥
                </Link>
              </nav>
            </div>

            {/* Center: Logo */}
            <Link
              href="/"
              className="absolute left-1/2 -translate-x-1/2 flex items-center"
            >
              <img
                src="/logo.svg"
                alt="Blackkin"
                className="h-7 w-auto"
              />
            </Link>

            {/* Right: Icons */}
            <div className="flex items-center gap-1">
              <CartIcon />

              <Link
                href={session ? "/account/wishlist" : loginHref}
                className="inline-flex items-center justify-center h-9 w-9 rounded hover:bg-accent transition-colors"
                aria-label="Wishlist"
              >
                <Heart className="h-5 w-5" />
              </Link>

              {isPending ? null : session ? (
                <Link
                  href="/account"
                  className="inline-flex items-center justify-center h-9 w-9 rounded hover:bg-accent transition-colors"
                  aria-label="Account"
                >
                  <User className="h-5 w-5" />
                </Link>
              ) : (
                <Link
                  href={loginHref}
                  className="inline-flex items-center justify-center h-9 w-9 rounded hover:bg-accent transition-colors"
                  aria-label="Sign in"
                >
                  <User className="h-5 w-5" />
                </Link>
              )}
            </div>
          </div>

          {/* Mobile Menu */}
          {mobileMenuOpen && (
            <div className="md:hidden border-t border-border bg-white">
              <nav className="flex flex-col py-3 px-6 gap-1">
                <Link
                  href="/products"
                  className="py-2.5 text-sm font-medium tracking-wide uppercase text-foreground"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Catalog
                </Link>
                <Link
                  href="/products?tag=new-arrivals"
                  className="py-2.5 text-sm font-medium tracking-wide uppercase text-foreground"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  New Arrivals
                </Link>
                <Link
                  href="/products?tag=sale"
                  className="py-2.5 text-sm font-semibold tracking-wide uppercase text-red-500"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Sale 🔥
                </Link>
                {session && (
                  <Link
                    href="/account"
                    className="py-2.5 text-sm font-medium tracking-wide uppercase text-foreground"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    My Account
                  </Link>
                )}
                {!isPending && !session && (
                  <Link
                    href={loginHref}
                    className="py-2.5 text-sm font-medium tracking-wide uppercase text-foreground"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Sign In
                  </Link>
                )}
              </nav>
            </div>
          )}
        </header>
      </div>
    </>
  );
}
