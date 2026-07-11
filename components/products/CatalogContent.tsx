"use client";

import { useMemo, useState } from "react";
import { Tag, LayoutGrid, Square } from "lucide-react";
import { Id } from "@/convex/_generated/dataModel";
import ProductCard from "@/components/products/ProductCard";
import ProductFilters from "@/components/products/ProductFilters";
import SortDropdown from "@/components/products/SortDropdown";
import { useUrlSearchParams } from "@/hooks/use-url-search-params";

interface CatalogProduct {
  _id: Id<"products">;
  _creationTime: number;
  name: string;
  slug: string;
  description: string;
  categoryId?: Id<"categories">;
  basePrice: number;
  effectivePrice: number;
  discountAmount: number;
  discountGroupName: string | null;
  discountEndTime: number | null;
  averageRating: number;
  totalRatings: number;
  globalSortOrder: number;
  imageUrl: string | null;
  hoverImageUrl?: string | null;
  colorFirstImageUrls?: Array<{ color: string; url: string | null }>;
  tags?: Array<{ _id: Id<"tags">; name: string; slug: string }>;
  variants?: Array<{
    _id: Id<"productVariants">;
    size: string;
    color?: string;
    stock: number;
  }>;
}

interface SaleGroup {
  _id: Id<"discountGroups">;
  name: string;
  discountType: "percentage" | "fixed";
  discountValue: number;
  endTime: number | null;
  products: CatalogProduct[];
}

interface Category {
  _id: Id<"categories">;
  name: string;
  slug: string;
}

interface Size {
  _id: Id<"platformSizes">;
  name: string;
  measurements: string;
}

interface Color {
  _id: Id<"platformColors">;
  name: string;
  hexCode: string;
}

interface CatalogContentProps {
  products: CatalogProduct[];
  sale: { groups: SaleGroup[]; individualProducts: CatalogProduct[] };
  categories: Category[];
  sizes: Size[];
  colors: Color[];
}

function ProductGrid({
  products,
  viewMode,
  colorHexMap,
}: {
  products: CatalogProduct[];
  viewMode: "grid" | "single";
  colorHexMap: Record<string, string>;
}) {
  return (
    <div
      className={`grid ${
        viewMode === "single" ? "grid-cols-1" : "grid-cols-2"
      } md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6`}
    >
      {products.map((product, index) => (
        <ProductCard
          key={product._id}
          product={product}
          imageUrl={product.imageUrl}
          hoverImageUrl={product.hoverImageUrl}
          colorFirstImageUrls={product.colorFirstImageUrls}
          colorHexMap={colorHexMap}
          priority={index < 2}
        />
      ))}
    </div>
  );
}

export default function CatalogContent({
  products,
  sale,
  categories,
  sizes,
  colors,
}: CatalogContentProps) {
  const searchParams = useUrlSearchParams();
  const [viewMode, setViewMode] = useState<"grid" | "single">("grid");
  const query = (searchParams.get("q") ?? "").trim().toLowerCase();
  const categoryId = searchParams.get("categoryId") ?? "";
  const selectedSizes = (searchParams.get("size") ?? "")
    .split(",")
    .filter(Boolean);
  const selectedColors = (searchParams.get("color") ?? "")
    .split(",")
    .filter(Boolean);
  const minPrice = Number(searchParams.get("minPrice") ?? "");
  const maxPrice = Number(searchParams.get("maxPrice") ?? "");
  const onSale = searchParams.get("onSale") === "true";
  const sortBy = searchParams.get("sortBy") ?? "recommended";
  const colorHexMap = Object.fromEntries(
    colors.map((color) => [color.name.toLowerCase(), color.hexCode]),
  );

  const filteredProducts = useMemo(() => {
    const filtered = products.filter((product) => {
      if (
        query &&
        !product.name.toLowerCase().includes(query) &&
        !product.description.toLowerCase().includes(query) &&
        !(product.tags ?? []).some((tag) =>
          tag.name.toLowerCase().includes(query),
        )
      ) {
        return false;
      }
      if (categoryId && String(product.categoryId) !== categoryId) return false;
      if (
        selectedSizes.length > 0 &&
        !(product.variants ?? []).some((variant) =>
          selectedSizes.includes(variant.size),
        )
      ) {
        return false;
      }
      if (
        selectedColors.length > 0 &&
        !(product.variants ?? []).some(
          (variant) =>
            variant.color && selectedColors.includes(variant.color),
        )
      ) {
        return false;
      }
      if (Number.isFinite(minPrice) && minPrice > 0 && product.basePrice < minPrice) {
        return false;
      }
      if (Number.isFinite(maxPrice) && maxPrice > 0 && product.basePrice > maxPrice) {
        return false;
      }
      return true;
    });

    return [...filtered].sort((a, b) => {
      if (sortBy === "price_asc") return a.effectivePrice - b.effectivePrice;
      if (sortBy === "price_desc") return b.effectivePrice - a.effectivePrice;
      if (sortBy === "newest") return b._creationTime - a._creationTime;
      if (sortBy === "best_selling") return b.totalRatings - a.totalRatings;
      return a.globalSortOrder - b.globalSortOrder;
    });
  }, [
    categoryId,
    maxPrice,
    minPrice,
    products,
    query,
    selectedColors,
    selectedSizes,
    sortBy,
  ]);

  const saleProductCount =
    sale.groups.reduce((total, group) => total + group.products.length, 0) +
    sale.individualProducts.length;
  const total = onSale ? saleProductCount : filteredProducts.length;
  const title = onSale ? "SALE" : query ? `SEARCH: "${query}"` : "CATALOG";

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-lg font-semibold tracking-wide uppercase">
            {title}
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            {total} {total === 1 ? "item" : "items"}
            {onSale ? " on sale" : ""}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {!onSale && (
            <SortDropdown />
          )}
          <ProductFilters
            categories={categories}
            sizes={sizes}
            colors={colors}
          />
          <div className="md:hidden flex items-center border border-border rounded overflow-hidden">
            <button
              onClick={() => setViewMode("grid")}
              aria-label="Grid view"
              className={`p-1.5 transition-colors ${
                viewMode === "grid"
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode("single")}
              aria-label="Single column view"
              className={`p-1.5 transition-colors ${
                viewMode === "single"
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Square className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {onSale ? (
        saleProductCount === 0 ? (
          <p className="text-muted-foreground text-sm py-16 text-center">
            No products on sale right now.
          </p>
        ) : (
          <div className="space-y-12">
            {sale.groups.map((group) => (
              <section key={group._id} className="space-y-4">
                <div className="flex items-center gap-3 border-b pb-3">
                  <Tag className="h-4 w-4 text-destructive flex-shrink-0" />
                  <div>
                    <h2 className="text-sm font-semibold tracking-wide uppercase">
                      {group.name}
                    </h2>
                    <p className="text-xs text-destructive mt-0.5">
                      {group.discountType === "percentage"
                        ? `${group.discountValue}% off`
                        : `৳${group.discountValue} off`}
                      {group.endTime && (
                        <span className="text-muted-foreground ml-2">
                          · Ends {new Date(group.endTime).toLocaleDateString()}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <ProductGrid
                  products={group.products}
                  viewMode={viewMode}
                  colorHexMap={colorHexMap}
                />
              </section>
            ))}
            {sale.individualProducts.length > 0 && (
              <section className="space-y-4">
                {sale.groups.length > 0 && (
                  <div className="flex items-center gap-3 border-b pb-3">
                    <Tag className="h-4 w-4 text-destructive flex-shrink-0" />
                    <h2 className="text-sm font-semibold tracking-wide uppercase">
                      More on Sale
                    </h2>
                  </div>
                )}
                <ProductGrid
                  products={sale.individualProducts}
                  viewMode={viewMode}
                  colorHexMap={colorHexMap}
                />
              </section>
            )}
          </div>
        )
      ) : filteredProducts.length === 0 ? (
        <p className="text-muted-foreground text-sm py-16 text-center">
          {query ? `No results for "${query}".` : "No products found."}
        </p>
      ) : (
        <ProductGrid
          products={filteredProducts}
          viewMode={viewMode}
          colorHexMap={colorHexMap}
        />
      )}
    </>
  );
}
