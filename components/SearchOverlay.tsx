"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { X, Search, ArrowRight, Loader2 } from "lucide-react";
import Link from "next/link";

interface SearchOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

export default function SearchOverlay({ isOpen, onClose }: SearchOverlayProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [inputValue, setInputValue] = useState("");
  const debouncedQuery = useDebounce(inputValue, 500);

  const suggestions = useQuery(
    api.products.searchSuggestions,
    debouncedQuery.trim().length >= 2 ? { query: debouncedQuery } : "skip",
  );

  const predefinedQueries = useQuery(
    api.platformConfig.listPredefinedSearchQueries,
  );

  const categories = useQuery(api.categories.list);

  // Focus input when overlay opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
      setInputValue("");
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const handleSearch = useCallback(
    (query: string) => {
      if (!query.trim()) return;
      onClose();
      router.push(`/products?q=${encodeURIComponent(query.trim())}`);
    },
    [router, onClose],
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleSearch(inputValue);
  };

  const handleCategoryClick = useCallback(
    (categoryId: string) => {
      onClose();
      router.push(`/products?categoryId=${categoryId}`);
    },
    [router, onClose],
  );

  const isLoading =
    debouncedQuery.trim().length >= 2 && suggestions === undefined;
  const hasSuggestions = suggestions && suggestions.length > 0;
  const showEmpty =
    debouncedQuery.trim().length >= 2 && !isLoading && !hasSuggestions;
  const showPredefined = debouncedQuery.trim().length < 2;

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] bg-white flex flex-col"
      aria-modal="true"
      role="dialog"
    >
      {/* Search bar row */}
      <div className="border-b border-border px-5 md:px-10 py-4 flex items-center gap-4 flex-shrink-0">
        <Search className="h-5 w-5 text-muted-foreground flex-shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search products, styles, descriptions..."
          className="flex-1 text-base md:text-lg outline-none placeholder:text-muted-foreground/60 bg-transparent"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
        />
        {inputValue && (
          <button
            onClick={() => setInputValue("")}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground transition-colors ml-2"
          aria-label="Close search"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-5 md:px-10 py-6 max-w-6xl mx-auto">
          {showPredefined ? (
            /* ── Empty state: predefined queries + categories ── */
            <div className="flex flex-col md:flex-row gap-10">
              {/* Predefined queries */}
              {predefinedQueries && predefinedQueries.length > 0 && (
                <div className="flex-1">
                  <p className="text-[11px] font-semibold tracking-[0.15em] uppercase text-muted-foreground mb-4">
                    Popular Searches
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {predefinedQueries.map((pq) => (
                      <button
                        key={pq._id}
                        onClick={() => {
                          setInputValue(pq.query);
                          handleSearch(pq.query);
                        }}
                        className="text-sm border border-border px-4 py-2 hover:bg-foreground hover:text-white transition-all duration-200"
                      >
                        {pq.query}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Categories */}
              {categories && categories.length > 0 && (
                <div className="w-full md:w-56 flex-shrink-0">
                  <p className="text-[11px] font-semibold tracking-[0.15em] uppercase text-muted-foreground mb-4">
                    Categories
                  </p>
                  <ul className="space-y-1">
                    {categories.map((cat) => (
                      <li key={cat._id}>
                        <button
                          onClick={() => handleCategoryClick(cat._id)}
                          className="text-sm text-left w-full py-1.5 hover:text-foreground text-muted-foreground transition-colors hover:translate-x-1 transform duration-200"
                        >
                          {cat.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            /* ── Active search results ── */
            <div className="flex flex-col md:flex-row gap-8">
              {/* Products column */}
              <div className="flex-1">
                <p className="text-[11px] font-semibold tracking-[0.15em] uppercase text-muted-foreground mb-4">
                  Products
                </p>

                {isLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Searching...
                  </div>
                ) : showEmpty ? (
                  <p className="text-sm text-muted-foreground py-4">
                    No products found for &ldquo;{debouncedQuery}&rdquo;
                  </p>
                ) : hasSuggestions ? (
                  <ul className="space-y-1">
                    {suggestions!.map((product) => (
                      <li key={product._id}>
                        <Link
                          href={`/products/${product.slug}`}
                          onClick={onClose}
                          className="flex items-center gap-4 p-2 -mx-2 hover:bg-accent rounded transition-colors group"
                        >
                          {/* Thumbnail */}
                          <div className="h-14 w-14 bg-muted flex-shrink-0 overflow-hidden">
                            {product.imageUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={product.imageUrl}
                                alt={product.name}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="h-full w-full bg-muted" />
                            )}
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium line-clamp-1 group-hover:text-foreground">
                              {/* Highlight matching text */}
                              {highlightMatch(product.name, debouncedQuery)}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-sm font-semibold">
                                ৳{product.effectivePrice.toLocaleString()}
                              </span>
                              {product.discountAmount > 0 && (
                                <span className="text-xs text-muted-foreground line-through">
                                  ৳{product.basePrice.toLocaleString()}
                                </span>
                              )}
                            </div>
                          </div>

                          <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : null}

                {/* View all button */}
                {debouncedQuery.trim().length >= 2 && !isLoading && (
                  <button
                    onClick={() => handleSearch(debouncedQuery)}
                    className="mt-6 flex items-center gap-2 text-sm font-medium border border-border px-5 py-3 hover:bg-foreground hover:text-white transition-all duration-200 w-full justify-center group"
                  >
                    View all results for &ldquo;{debouncedQuery}&rdquo;
                    <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </button>
                )}
              </div>

              {/* Categories column */}
              {categories && categories.length > 0 && (
                <div className="w-full md:w-52 flex-shrink-0">
                  <p className="text-[11px] font-semibold tracking-[0.15em] uppercase text-muted-foreground mb-4">
                    Categories
                  </p>
                  <ul className="space-y-1">
                    {categories.map((cat) => (
                      <li key={cat._id}>
                        <button
                          onClick={() => handleCategoryClick(cat._id)}
                          className="text-sm text-left w-full py-1.5 hover:text-foreground text-muted-foreground transition-colors"
                        >
                          {cat.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Highlight matching portion of text */
function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase().trim());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <strong className="font-bold">
        {text.slice(idx, idx + query.trim().length)}
      </strong>
      {text.slice(idx + query.trim().length)}
    </>
  );
}
