"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { authClient } from "@/lib/auth-client";
import { CartIcon } from "@/components/cart/CartIcon";
import SearchOverlay from "@/components/SearchOverlay";
import { Heart, Search, User, X, Menu, Flame } from "lucide-react";

export function Navbar() {
  const pathname = usePathname();
  if (pathname?.startsWith("/admin")) return null;
  return <NavbarInner />;
}

function NavbarInner() {
  const pathname = usePathname();
  const { data: session, isPending } = authClient.useSession();

  const [announcementDismissed, setAnnouncementDismissed] = useState(false);
  const [navVisible, setNavVisible] = useState(true);
  const [atTop, setAtTop] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const lastScrollY = useRef(0);
  const ticking = useRef(false);

  const navbarCategories = useQuery(api.platformConfig.listNavbarCategories);

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
        setNavVisible(false);
        setMobileMenuOpen(false);
      } else if (currentScrollY < lastScrollY.current) {
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

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  const showAnnouncement = !announcementDismissed && atTop && pathname === "/";
  const announcementHeight = showAnnouncement ? 36 : 0;

  const isHomePage = pathname === "/";
  const spacerHeight = isHomePage ? 0 : announcementHeight + 80;

  const loginHref =
    pathname && pathname !== "/login" && pathname !== "/register"
      ? `/login?next=${encodeURIComponent(pathname)}`
      : "/login";

  return (
    <>
      <div style={{ height: `${spacerHeight}px` }} />

      <SearchOverlay isOpen={searchOpen} onClose={() => setSearchOpen(false)} />

      <div
        className="navbar-wrapper fixed top-0 left-0 right-0 z-50"
        style={{
          transform: navVisible ? "translateY(0)" : "translateY(-100%)",
          transition: "transform 0.3s ease",
        }}
      >
        {/* Announcement Bar */}
        {!announcementDismissed && isHomePage && (
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
                  <span>Blackkin</span>
                  <span>·</span>
                  <span>Be Bold</span>
                  <span>·</span>
                  <span>Premium Comfort</span>
                  <span>·</span>
                  <span>Blackkin</span>
                  <span>·</span>
                  <span>Be Bold</span>
                  <span>·</span>
                  <span>Premium Comfort</span>
                  <span>·</span>
                  <span>Blackkin</span>
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
        <header
          className={`transition-colors duration-300 bg-white border-b border-border
            ${
              atTop
                ? "bg-transparent border-transparent"
                : "bg-white border-b border-border"
            }`}
        >
          <div className="w-full max-w-[1500px] mx-auto px-6 lg:px-10 h-20 flex items-center justify-between relative">
            {/* Left: Hamburger + Search (mobile) / Nav links (desktop) */}
            <div className="flex items-center">
              {/* Hamburger */}
              <button
                className="md:hidden inline-flex items-center justify-center h-9 w-9 rounded hover:bg-accent transition-colors"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                aria-label="Toggle menu"
              >
                <Menu className="h-5 w-5" />
              </button>
              {/* Search icon — mobile only, in left group */}
              <button
                onClick={() => setSearchOpen(true)}
                className="md:hidden icon-btn-hover inline-flex items-center justify-center h-9 w-9 rounded hover:bg-accent"
                aria-label="Search"
              >
                <Search className="h-5 w-5" />
              </button>

              {/* Desktop nav */}
              <nav className="hidden md:flex items-center text-xs font-medium tracking-wide uppercase">
                <Link
                  href="/products"
                  className={`px-3 py-1.5 relative transition-colors hover:text-foreground group ${
                    pathname === "/products"
                      ? "text-foreground"
                      : "text-muted-foreground"
                  }`}
                >
                  Catalog
                  <span className="sweep-underline absolute bottom-0 left-3 right-3 h-px bg-foreground/50" />
                </Link>

                {navbarCategories?.map((cat) => (
                  <Link
                    key={cat.categoryId}
                    href={`/products?categoryId=${cat.categoryId}`}
                    className="px-3 py-1.5 relative text-muted-foreground hover:text-foreground transition-colors group"
                  >
                    {cat.name}
                    <span className="sweep-underline absolute bottom-0 left-3 right-3 h-px bg-foreground" />
                  </Link>
                ))}

                <Link
                  href="/products?onSale=true"
                  className="px-3 py-1.5 relative text-red-500 hover:text-red-600 font-semibold transition-colors flex items-center gap-1 group"
                >
                  Sale
                  <Flame className="h-3.5 w-3.5" />
                  <span className="sweep-underline absolute bottom-0 left-3 right-3 h-px bg-red-500" />
                </Link>
              </nav>
            </div>

            {/* Center: Logo */}
            <Link
              href="/"
              className="absolute left-1/2 -translate-x-1/2 flex items-center"
            >
              <img
                src="/assets/blackkin_logo_text_black_trimmed.svg"
                alt="Blackkin"
                className="h-10 md:h-16 w-auto"
              />
            </Link>

            {/* Right: Cart, Wishlist, Account (Search only on desktop) */}
            <div className="flex items-center gap-0.5">
              {/* Search — desktop only */}
              <button
                onClick={() => setSearchOpen(true)}
                className="hidden md:inline-flex icon-btn-hover items-center justify-center h-9 w-9 rounded hover:bg-accent"
                aria-label="Search"
              >
                <Search className="h-5 w-5" />
              </button>

              <CartIcon />

              <Link
                href={session ? "/account/wishlist" : loginHref}
                className="icon-btn-hover inline-flex items-center justify-center h-9 w-9 rounded hover:bg-accent"
                aria-label="Wishlist"
              >
                <Heart className="h-5 w-5" />
              </Link>

              {isPending ? null : session ? (
                <Link
                  href="/account"
                  className="icon-btn-hover inline-flex items-center justify-center h-9 w-9 rounded hover:bg-accent"
                  aria-label="Account"
                >
                  <User className="h-5 w-5" />
                </Link>
              ) : (
                <Link
                  href={loginHref}
                  className="icon-btn-hover inline-flex items-center justify-center h-9 w-9 rounded hover:bg-accent"
                  aria-label="Sign in"
                >
                  <User className="h-5 w-5" />
                </Link>
              )}
            </div>
          </div>

          {/* Mobile Menu */}
          {mobileMenuOpen && (
            <div className="mobile-menu-animate md:hidden border-t border-border bg-white">
              <nav className="flex flex-col py-3 px-6 gap-1">
                <Link
                  href="/products"
                  className="py-2.5 text-sm font-medium tracking-wide uppercase text-foreground"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Catalog
                </Link>
                {navbarCategories?.map((cat) => (
                  <Link
                    key={cat.categoryId}
                    href={`/products?categoryId=${cat.categoryId}`}
                    className="py-2.5 text-sm font-medium tracking-wide uppercase text-foreground"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {cat.name}
                  </Link>
                ))}
                <Link
                  href="/products?onSale=true"
                  className="py-2.5 text-sm font-semibold tracking-wide uppercase text-red-500 flex items-center gap-1.5"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Sale <Flame className="h-3.5 w-3.5" />
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
