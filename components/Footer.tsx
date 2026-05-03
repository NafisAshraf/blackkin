"use client";

import { useState } from "react";
import Link from "next/link";

// Custom Social Icons since they are missing in the current lucide-react version
const Facebook = ({ size = 24, ...props }: any) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    {...props}
  >
    <path d="M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h7v-7h-2v-3h2V8.5A3.5 3.5 0 0 1 15.5 5H18v3h-2c-.55 0-1 .45-1 1V11h3l-.5 3H15v7h4a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2z" />
  </svg>
);

const Instagram = ({ size = 24, ...props }: any) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
  </svg>
);

const Youtube = ({ size = 24, ...props }: any) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    {...props}
  >
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
  </svg>
);

export function Footer() {
  const [email, setEmail] = useState("");

  return (
    <footer className="w-full bg-black pt-12 ">
      <div className="w-full bg-black pt-12 max-w-[1500px] mx-auto">
        {/* Newsletter Section */}
        <div className="anim-on-scroll text-white pt-10 pb-18 px-6 text-center">
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
            <div className="anim-on-scroll col-span-2 md:col-span-1 flex flex-col gap-6 items-center text-center pe-28">
              <Link href="/">
                <img
                  src="/assets/blackkin_logo_text_black_trimmed.svg"
                  alt="Blackkin"
                  style={{
                    height: "auto",
                    width: "200px",
                    display: "block",
                    filter: "invert(1)",
                    opacity: 0.85,
                  }}
                  className="hover:opacity-100 transition-opacity"
                />
              </Link>
              {/* Social Icons */}
              <div className="flex items-center gap-4">
                <a
                  href="#"
                  className="h-10 w-10 rounded-full border border-white/20 flex items-center justify-center text-white/60 hover:bg-white hover:text-black hover:border-white transition-all hover:scale-110"
                  aria-label="Facebook"
                >
                  <Facebook size={18} />
                </a>
                <a
                  href="#"
                  className="h-10 w-10 rounded-full border border-white/20 flex items-center justify-center text-white/60 hover:bg-white hover:text-black hover:border-white transition-all hover:scale-110"
                  aria-label="Instagram"
                >
                  <Instagram size={18} />
                </a>
                <a
                  href="#"
                  className="h-10 w-10 rounded-full border border-white/20 flex items-center justify-center text-white/60 hover:bg-white hover:text-black hover:border-white transition-all hover:scale-110"
                  aria-label="YouTube"
                >
                  <Youtube size={18} />
                </a>
              </div>
            </div>

            {/* Shopping Links */}
            <div className="anim-on-scroll anim-d1">
              <h4 className="text-xs font-semibold tracking-wider uppercase text-white/50 mb-4">
                Shopping
              </h4>
              <nav className="flex flex-col gap-2.5">
                <Link
                  href="/products"
                  className="group relative inline-block text-sm text-white/70 hover:text-white transition-colors pb-0.5"
                >
                  Catalog
                </Link>
                <Link
                  href="/products?tag=sale"
                  className="group relative inline-block text-sm text-white/70 hover:text-white transition-colors pb-0.5"
                >
                  Sale
                </Link>
                <Link
                  href="/products?tag=new-arrivals"
                  className="group relative inline-block text-sm text-white/70 hover:text-white transition-colors pb-0.5"
                >
                  About Us
                </Link>
                <Link
                  href="/products"
                  className="group relative inline-block text-sm text-white/70 hover:text-white transition-colors pb-0.5"
                >
                  Contact Us
                </Link>
              </nav>
            </div>

            {/* Contact */}
            <div className="anim-on-scroll anim-d2">
              <h4 className="text-xs font-semibold tracking-wider uppercase text-white/50 mb-4">
                Contact Us
              </h4>
              <div className="flex flex-col gap-2.5 text-sm text-white/70">
                <a
                  href="tel:+8801234567890"
                  className="group relative inline-block hover:text-white transition-colors pb-0.5"
                >
                  +880 1234-567890
                </a>
                <a
                  href="mailto:info@blackkin.com"
                  className="group relative inline-block hover:text-white transition-colors pb-0.5"
                >
                  [EMAIL_ADDRESS]
                </a>
              </div>
            </div>

            {/* Find Us */}
            <div className="anim-on-scroll anim-d3">
              <h4 className="text-xs font-semibold tracking-wider uppercase text-white/50 mb-4">
                Find Us
              </h4>
              <div className="flex flex-col gap-2.5 text-sm text-white/70">
                <span>Dhaka, Bangladesh</span>
                <span className="text-xs text-white/50">
                  Everyday 10am to 9pm
                </span>
              </div>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="anim-on-scroll pt-6 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-xs text-white/40">© 2026 Blackkin</p>
            <div className="flex items-center gap-4 text-xs text-white/40">
              <p>Privacy Policy</p>
            </div>
          </div>

          <div className="mt-8 flex justify-center">
            <img
              src="/assets/blackkin_footer.png"
              alt="Blackkin"
              style={{
                width: "100%",
                maxWidth: "none",
                display: "block",
                opacity: 0.45,
                userSelect: "none",
                pointerEvents: "none",
              }}
              className="anim-on-scroll"
            />
          </div>
        </div>
      </div>
    </footer>
  );
}
