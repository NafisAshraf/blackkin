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

  if (quotes.length === 0) return null;

  const safeActive = active % quotes.length;
  const quote = quotes[safeActive];

  const prev = () =>
    setActive((i) => (i - 1 + quotes.length) % quotes.length);
  const next = () => setActive((i) => (i + 1) % quotes.length);

  return (
    <section className="relative w-full bg-[#f5f5f5] py-24 md:py-32 flex items-center justify-center overflow-hidden">
      {/* Prev Arrow */}
      <button
        onClick={prev}
        aria-label="Previous quote"
        className="absolute left-6 md:left-10 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full border border-gray-400 flex items-center justify-center text-gray-500 hover:border-gray-700 hover:text-gray-700 transition-colors text-sm"
      >
        &#8249;
      </button>

      {/* Quote Content */}
      <div className="max-w-2xl mx-auto px-16 md:px-20 text-center">
        {/* Large quotation mark */}
        <div className="text-6xl md:text-7xl text-gray-200 leading-none select-none mb-6 font-serif">
          &rdquo;
        </div>

        {/* Quote text */}
        <p className="text-base md:text-lg text-foreground leading-relaxed tracking-wide">
          {quote.text}
        </p>

        {/* Author */}
        <p className="mt-6 text-sm text-muted-foreground tracking-[0.1em]">
          {quote.author}
        </p>
      </div>

      {/* Next Arrow */}
      <button
        onClick={next}
        aria-label="Next quote"
        className="absolute right-6 md:right-10 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full border border-gray-400 flex items-center justify-center text-gray-500 hover:border-gray-700 hover:text-gray-700 transition-colors text-sm"
      >
        &#8250;
      </button>
    </section>
  );
}
