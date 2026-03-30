"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Input } from "@/components/ui/input";
import { Loader2, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProductPickerProps {
  onSelect: (product: { id: Id<"products">; name: string }) => void;
  placeholder?: string;
  className?: string;
}

export function ProductPicker({ onSelect, placeholder = "Search for a product...", className }: ProductPickerProps) {
  const [inputValue, setInputValue] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Debounce input
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(inputValue), 300);
    return () => clearTimeout(t);
  }, [inputValue]);

  const results = useQuery(
    api.products.searchForPicker,
    debouncedQuery.trim() ? { query: debouncedQuery } : "skip"
  );

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function handleSelect(item: { _id: Id<"products">; name: string; slug: string }) {
    onSelect({ id: item._id, name: item.name });
    setInputValue("");
    setDebouncedQuery("");
    setOpen(false);
  }

  const showDropdown = open && debouncedQuery.trim().length > 0;
  const isLoading = debouncedQuery.trim().length > 0 && results === undefined;

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="pl-8 pr-8"
        />
        {inputValue && (
          <button
            type="button"
            onClick={() => { setInputValue(""); setDebouncedQuery(""); setOpen(false); }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {showDropdown && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md">
          {isLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : results && results.length === 0 ? (
            <p className="px-3 py-4 text-sm text-muted-foreground text-center">No products found</p>
          ) : (
            <ul className="max-h-64 overflow-y-auto py-1">
              {(results ?? []).map((item) => (
                <li key={item._id}>
                  <button
                    type="button"
                    onClick={() => handleSelect(item)}
                    className="w-full px-3 py-2 text-left hover:bg-accent text-sm"
                  >
                    <p className="font-medium">{item.name}</p>
                    <p className="text-xs text-muted-foreground">{item.slug}</p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
