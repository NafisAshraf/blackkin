"use client";

import { useState } from "react";

export interface CarouselQuote {
  _id: string;
  text: string;
  author: string;
}

interface QuoteCarouselProps {
  quotes: CarouselQuote[];
}

export function QuoteCarousel({ quotes }: QuoteCarouselProps) {
  const [active, setActive] = useState(0);
  // Bump this key on navigation to retrigger CSS animation
  const [animKey, setAnimKey] = useState(0);

  if (quotes.length === 0) return null;

  const safeActive = active % quotes.length;
  const quote = quotes[safeActive];

  const navigate = (next: number) => {
    setActive(next);
    setAnimKey((k) => k + 1);
  };

  const prev = () => navigate((active - 1 + quotes.length) % quotes.length);
  const nextQ = () => navigate((active + 1) % quotes.length);

  return (
    <section
      className="relative w-full bg-[#f5f5f5] flex items-center justify-center overflow-hidden"
      style={{ minHeight: "480px" }}
    >
      {/* Prev Arrow */}
      <button
        onClick={prev}
        aria-label="Previous quote"
        className="absolute left-6 md:left-10 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full border border-gray-400 flex items-center justify-center text-gray-500 hover:border-gray-700 hover:text-gray-700 transition-colors text-sm shrink-0 z-10"
      >
        &#8249;
      </button>

      {/* Quote Content — fixed-height inner, centered */}
      <div
        key={animKey}
        className="quote-enter max-w-2xl mx-auto px-16 md:px-20 text-center py-20"
      >
        {/* Large quotation mark */}
        <div className="text-6xl md:text-7xl text-gray-200 leading-none select-none mb-4 font-serif">
          &rdquo;
        </div>

        {/* Quote text — 3-line clamp with ellipsis */}
        <p
          className="text-xl md:text-2xl text-foreground leading-relaxed tracking-wide overflow-hidden"
          style={{
            display: "-webkit-box",
            WebkitLineClamp: 3,
            WebkitBoxOrient: "vertical",
          }}
        >
          {quote.text}
        </p>

        {/* Author */}
        <p className="mt-5 text-sm text-muted-foreground tracking-[0.1em] truncate max-w-xs mx-auto">
          {quote.author}
        </p>
      </div>

      {/* Next Arrow */}
      <button
        onClick={nextQ}
        aria-label="Next quote"
        className="absolute right-6 md:right-10 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full border border-gray-400 flex items-center justify-center text-gray-500 hover:border-gray-700 hover:text-gray-700 transition-colors text-sm shrink-0 z-10"
      >
        &#8250;
      </button>
    </section>
  );
}
