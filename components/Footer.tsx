"use client";

import { useState } from "react";
import Link from "next/link";

export function Footer() {
  const [email, setEmail] = useState("");

  return (
    <footer className="w-full">
      {/* Newsletter Section */}
      <div className="bg-[#1a1a1a] text-white py-10 px-6 text-center">
        <h3 className="text-lg font-semibold tracking-[0.15em] uppercase mb-1">
          Stay Comfortable. Stay Updated.
        </h3>
        <p className="text-white/60 text-sm mb-5">
          Get Exclusive Offers on Premium Comfort
        </p>
        <div className="flex items-center justify-center gap-2 max-w-md mx-auto">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="flex-1 h-10 px-4 bg-transparent border border-white/30 text-white text-sm placeholder:text-white/40 focus:outline-none focus:border-white transition-colors"
          />
          <button className="h-10 px-5 bg-white text-black text-xs font-semibold tracking-wider uppercase hover:bg-white/90 transition-colors whitespace-nowrap">
            Get Discount
          </button>
        </div>
      </div>

      {/* Main Footer */}
      <div className="bg-black text-white py-12 px-6 lg:px-10">
        <div className="w-full grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
          {/* Logo */}
          <div className="col-span-2 md:col-span-1 flex items-start">
            <Link href="/">
              <img
                src="/logo-white.svg"
                alt="Blackkin"
                className="h-12 w-auto opacity-80 hover:opacity-100 transition-opacity"
              />
            </Link>
          </div>

          {/* Shopping Links */}
          <div>
            <h4 className="text-xs font-semibold tracking-wider uppercase text-white/50 mb-4">
              Shopping
            </h4>
            <nav className="flex flex-col gap-2.5">
              <Link
                href="/products"
                className="text-sm text-white/70 hover:text-white transition-colors"
              >
                Catalog
              </Link>
              <Link
                href="/products?tag=sale"
                className="text-sm text-white/70 hover:text-white transition-colors"
              >
                Sale
              </Link>
              <Link
                href="/products?tag=new-arrivals"
                className="text-sm text-white/70 hover:text-white transition-colors"
              >
                About Us
              </Link>
              <Link
                href="/products"
                className="text-sm text-white/70 hover:text-white transition-colors"
              >
                Contact Us
              </Link>
            </nav>
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-xs font-semibold tracking-wider uppercase text-white/50 mb-4">
              Contact Us
            </h4>
            <div className="flex flex-col gap-2.5 text-sm text-white/70">
              <a
                href="tel:+8801234567890"
                className="hover:text-white transition-colors"
              >
                +880 1234-567890
              </a>
              <a
                href="mailto:info@blackkin.com"
                className="hover:text-white transition-colors"
              >
                info@blackkin.com
              </a>
            </div>
          </div>

          {/* Terms */}
          <div>
            <h4 className="text-xs font-semibold tracking-wider uppercase text-white/50 mb-4">
              Terms
            </h4>
            <div className="flex flex-col gap-2.5 text-sm text-white/70">
              <span>Dhaka, Bangladesh</span>
              <Link
                href="#"
                className="hover:text-white transition-colors"
              >
                Privacy Policy
              </Link>
            </div>
          </div>
        </div>

        {/* Social Icons */}
        <div className="flex items-center gap-4 mb-10">
          <a
            href="#"
            className="text-white/50 hover:text-white transition-colors"
            aria-label="Facebook"
          >
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
            </svg>
          </a>
          <a
            href="#"
            className="text-white/50 hover:text-white transition-colors"
            aria-label="Instagram"
          >
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
            </svg>
          </a>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-white/10 pt-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-white/40">© 2026 Blackkin</p>
          <p className="text-xs text-white/40">Privacy Policy</p>
        </div>

        {/* Large wordmark */}
        <div className="mt-8 text-center">
          <p
            className="text-6xl md:text-8xl lg:text-9xl font-bold tracking-[0.1em] uppercase text-white/10 select-none"
            style={{ fontFamily: "var(--font-sans)" }}
          >
            BLACKKIN
          </p>
        </div>
      </div>
    </footer>
  );
}
