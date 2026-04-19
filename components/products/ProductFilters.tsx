"use client";

import { useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { SlidersHorizontal, X } from "lucide-react";

interface Category {
  _id: string;
  name: string;
  slug: string;
}

interface Size {
  _id: string;
  name: string;
}

interface Color {
  _id: string;
  name: string;
  hexCode: string; // now required
}

interface ProductFiltersProps {
  categories: Category[];
  sizes: Size[];
  colors: Color[];
}



function FilterSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div className="border-b border-border pb-4">
      <button
        type="button"
        className="flex w-full items-center justify-between py-3 text-sm font-semibold"
        onClick={() => setOpen((o) => !o)}
      >
        {title}
        <span className="text-muted-foreground">{open ? "−" : "+"}</span>
      </button>
      {open && <div className="space-y-2">{children}</div>}
    </div>
  );
}

export default function ProductFilters({
  categories,
  sizes,
  colors,
}: ProductFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);

  const currentCategory = searchParams.get("categoryId") ?? "";
  const currentSize = searchParams.get("size") ?? "";
  const currentColor = searchParams.get("color") ?? "";
  const currentMinPrice = searchParams.get("minPrice") ?? "";
  const currentMaxPrice = searchParams.get("maxPrice") ?? "";
  const isOnSale = searchParams.get("onSale") === "true";

  // Local draft state — only applied on close/apply
  const [draftCategory, setDraftCategory] = useState(currentCategory);
  const [draftSize, setDraftSize] = useState<string[]>(currentSize ? currentSize.split(",") : []);
  const [draftColor, setDraftColor] = useState<string[]>(currentColor ? currentColor.split(",") : []);
  const [draftMinPrice, setDraftMinPrice] = useState(currentMinPrice);
  const [draftMaxPrice, setDraftMaxPrice] = useState(currentMaxPrice);
  const [draftOnSale, setDraftOnSale] = useState(isOnSale);

  // Count active filters for badge
  const activeCount = [
    isOnSale,
    !!currentCategory,
    !!currentSize,
    !!currentColor,
    !!currentMinPrice || !!currentMaxPrice,
  ].filter(Boolean).length;

  const applyFilters = useCallback(() => {
    const params = new URLSearchParams();
    // Preserve search query
    const q = searchParams.get("q");
    if (q) params.set("q", q);

    if (draftOnSale) {
      params.set("onSale", "true");
    } else {
      if (draftCategory) params.set("categoryId", draftCategory);
      if (draftSize.length > 0) params.set("size", draftSize.join(","));
      if (draftColor.length > 0) params.set("color", draftColor.join(","));
      if (draftMinPrice) params.set("minPrice", draftMinPrice);
      if (draftMaxPrice) params.set("maxPrice", draftMaxPrice);
    }
    // Preserve sort
    const sortBy = searchParams.get("sortBy");
    if (sortBy) params.set("sortBy", sortBy);

    router.push(`?${params.toString()}`);
    setOpen(false);
  }, [
    draftOnSale,
    draftCategory,
    draftSize,
    draftColor,
    draftMinPrice,
    draftMaxPrice,
    searchParams,
    router,
  ]);

  const clearAll = useCallback(() => {
    setDraftCategory("");
    setDraftSize([]);
    setDraftColor([]);
    setDraftMinPrice("");
    setDraftMaxPrice("");
    setDraftOnSale(false);
    const params = new URLSearchParams();
    const q = searchParams.get("q");
    if (q) params.set("q", q);
    const sortBy = searchParams.get("sortBy");
    if (sortBy) params.set("sortBy", sortBy);
    router.push(`?${params.toString()}`);
    setOpen(false);
  }, [searchParams, router]);

  const handleOpenChange = (val: boolean) => {
    if (val) {
      setDraftCategory(currentCategory);
      setDraftSize(currentSize ? currentSize.split(",") : []);
      setDraftColor(currentColor ? currentColor.split(",") : []);
      setDraftMinPrice(currentMinPrice);
      setDraftMaxPrice(currentMaxPrice);
      setDraftOnSale(isOnSale);
    }
    setOpen(val);
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>
        <button className="relative flex items-center gap-2 text-xs font-medium border border-border px-3 py-2 hover:bg-muted transition-colors">
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Filter
          {activeCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-foreground text-white text-[9px] font-bold flex items-center justify-center">
              {activeCount}
            </span>
          )}
        </button>
      </SheetTrigger>

      <SheetContent side="left" className="w-80 max-w-[90vw] flex flex-col p-0">
        <SheetHeader className="px-6 py-4 border-b border-border flex-shrink-0">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-sm font-semibold uppercase tracking-wide">
              Filters
            </SheetTitle>
            {activeCount > 0 && (
              <button
                onClick={clearAll}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 pr-6"
              >
                <X className="h-3 w-3" />
                Clear all
              </button>
            )}
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-2 space-y-0">
          {/* On Sale */}
          <div className="border-b border-border py-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={draftOnSale}
                onChange={(e) => {
                  setDraftOnSale(e.target.checked);
                  if (e.target.checked) {
                    setDraftCategory("");
                    setDraftSize([]);
                    setDraftColor([]);
                    setDraftMinPrice("");
                    setDraftMaxPrice("");
                  }
                }}
                className="h-4 w-4 rounded border-border"
              />
              <span className="text-sm font-medium">On Sale</span>
            </label>
          </div>

          {categories.length > 0 && !draftOnSale && (
            <FilterSection title="Category">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setDraftCategory("")}
                  className={`px-3 py-1.5 text-xs font-medium border transition-colors ${
                    draftCategory === ""
                      ? "border-foreground bg-foreground text-white"
                      : "border-border hover:border-foreground text-foreground"
                  }`}
                >
                  All
                </button>
                {categories.map((c) => (
                  <button
                    key={c._id}
                    type="button"
                    onClick={() => setDraftCategory(c._id)}
                    className={`px-3 py-1.5 text-xs font-medium border transition-colors ${
                      draftCategory === c._id
                        ? "border-foreground bg-foreground text-white"
                        : "border-border hover:border-foreground text-foreground"
                    }`}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </FilterSection>
          )}

          {/* Size */}
          {sizes.length > 0 && !draftOnSale && (
            <FilterSection title="Size">
              <div className="flex flex-wrap gap-2">
                {sizes.map((s) => (
                  <button
                    key={s._id}
                    type="button"
                    onClick={() =>
                      setDraftSize((prev) =>
                        prev.includes(s.name)
                          ? prev.filter((sz) => sz !== s.name)
                          : [...prev, s.name]
                      )
                    }
                    className={`px-3 py-1.5 text-xs font-medium border transition-colors ${
                      draftSize.includes(s.name)
                        ? "border-foreground bg-foreground text-white"
                        : "border-border hover:border-foreground"
                    }`}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            </FilterSection>
          )}

          {/* Color */}
          {colors.length > 0 && !draftOnSale && (
            <FilterSection title="Color">
              <div className="flex flex-wrap gap-2.5">
                {colors.map((c) => {
                  const hex = c.hexCode;
                  const isSelected = draftColor.includes(c.name);
                  return (
                    <button
                      key={c._id}
                      type="button"
                      title={c.name}
                      onClick={() =>
                        setDraftColor((prev) =>
                          prev.includes(c.name)
                            ? prev.filter((col) => col !== c.name)
                            : [...prev, c.name]
                        )
                      }
                      className={`h-7 w-7 rounded-full transition-all ${
                        isSelected
                          ? "border-2 border-foreground scale-110"
                          : "border border-gray-300 hover:border-gray-400 hover:scale-105"
                      }`}
                      style={{
                        backgroundColor: hex,
                      }}
                    />
                  );
                })}
              </div>
              {draftColor.length > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  Selected:{" "}
                  <span className="font-medium text-foreground">
                    {draftColor.join(", ")}
                  </span>
                </p>
              )}
            </FilterSection>
          )}

          {/* Price Range */}
          {!draftOnSale && (
            <FilterSection title="Price Range">
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <Label className="text-xs text-muted-foreground mb-1 block">
                    Min (৳)
                  </Label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={draftMinPrice}
                    onChange={(e) => setDraftMinPrice(e.target.value)}
                    className="h-8 text-sm"
                    min={0}
                  />
                </div>
                <span className="text-muted-foreground mt-5">—</span>
                <div className="flex-1">
                  <Label className="text-xs text-muted-foreground mb-1 block">
                    Max (৳)
                  </Label>
                  <Input
                    type="number"
                    placeholder="∞"
                    value={draftMaxPrice}
                    onChange={(e) => setDraftMaxPrice(e.target.value)}
                    className="h-8 text-sm"
                    min={0}
                  />
                </div>
              </div>
            </FilterSection>
          )}
        </div>

        {/* Apply button */}
        <div className="px-6 py-4 border-t border-border flex-shrink-0">
          <Button onClick={applyFilters} className="w-full">
            Show Results
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
