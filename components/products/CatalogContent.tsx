"use client";

import { useState, Suspense } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Loader2, Tag } from "lucide-react";
import ProductCard from "@/components/products/ProductCard";
import ProductFilters from "@/components/products/ProductFilters";
import SortDropdown from "@/components/products/SortDropdown";

const INITIAL_LIMIT = 24;

interface MediaItem {
  storageId: string;
  type: "image" | "video" | "model3d";
  sortOrder: number;
}

interface CatalogProduct {
  _id: Id<"products">;
  name: string;
  slug: string;
  basePrice: number;
  effectivePrice: number;
  discountAmount: number;
  discountGroupName: string | null;
  discountEndTime: number | null;
  averageRating: number;
  totalRatings: number;
  imageUrl: string | null;
  media: MediaItem[];
  tags?: Array<{ _id: string; name: string; slug: string }>;
  variants?: Array<{ color?: string }>;
}

interface SaleGroup {
  _id: Id<"discountGroups">;
  name: string;
  discountType: "percentage" | "fixed";
  discountValue: number;
  endTime: number | null;
  products: CatalogProduct[];
}

interface SaleData {
  groups: SaleGroup[];
  individualProducts: CatalogProduct[];
}

interface FilteredData {
  products: CatalogProduct[];
  hasMore: boolean;
  total: number;
}

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
  hexCode: string; // required
}

interface QueryArgs {
  categoryId?: string;
  size?: string;
  color?: string;
  minPrice?: number;
  maxPrice?: number;
  sortBy?: string;
}

interface CatalogContentProps {
  mode: "filtered" | "search" | "sale";
  initialData: FilteredData | SaleData | null;
  categories: Category[];
  sizes: Size[];
  colors: Color[];
  queryArgs: QueryArgs;
  searchQuery?: string;
}

function ProductGrid({ products }: { products: CatalogProduct[] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
      {products.map((product) => (
        <ProductCard
          key={product._id}
          product={{
            _id: product._id,
            name: product.name,
            slug: product.slug,
            basePrice: product.basePrice,
            effectivePrice: product.effectivePrice,
            discountAmount: product.discountAmount,
            discountGroupName: product.discountGroupName,
            discountEndTime: product.discountEndTime,
            averageRating: product.averageRating,
            totalRatings: product.totalRatings,
            media: product.media ?? [],
            tags: product.tags,
            variants: product.variants,
          }}
          imageUrl={product.imageUrl}
        />
      ))}
    </div>
  );
}

export default function CatalogContent({
  mode,
  initialData,
  categories,
  sizes,
  colors,
  queryArgs,
  searchQuery,
}: CatalogContentProps) {
  const [limit, setLimit] = useState(INITIAL_LIMIT);

  // Only activate client query when loading more in filtered/search mode
  const shouldFetchMore = mode === "filtered" && limit > INITIAL_LIMIT;

  const clientData = useQuery(
    api.products.listFilteredSSR,
    shouldFetchMore
      ? {
          ...(queryArgs.categoryId
            ? { categoryId: queryArgs.categoryId as Id<"categories"> }
            : {}),
          ...(queryArgs.size ? { size: queryArgs.size } : {}),
          ...(queryArgs.color ? { color: queryArgs.color } : {}),
          ...(queryArgs.minPrice !== undefined
            ? { minPrice: queryArgs.minPrice }
            : {}),
          ...(queryArgs.maxPrice !== undefined
            ? { maxPrice: queryArgs.maxPrice }
            : {}),
          ...(queryArgs.sortBy
            ? {
                sortBy: queryArgs.sortBy as
                  | "recommended"
                  | "price_asc"
                  | "price_desc"
                  | "newest"
                  | "best_selling",
              }
            : {}),
          limit,
        }
      : "skip",
  ) as FilteredData | undefined;

  let products: CatalogProduct[] = [];
  let hasMore = false;
  let total = 0;

  if (mode === "sale") {
    // Sale data is structured differently — flattened for simplicity
    const saleData = initialData as SaleData | null;
    const allSaleProducts = [
      ...(saleData?.groups.flatMap((g) => g.products) ?? []),
      ...(saleData?.individualProducts ?? []),
    ];
    total = allSaleProducts.length;
  } else {
    const filteredInit = initialData as FilteredData | null;
    products = clientData?.products ?? filteredInit?.products ?? [];
    hasMore = clientData?.hasMore ?? filteredInit?.hasMore ?? false;
    total = clientData?.total ?? filteredInit?.total ?? 0;
  }

  const isLoadingMore = shouldFetchMore && clientData === undefined;

  let pageTitle = "CATALOG";
  if (mode === "sale") pageTitle = "SALE";
  else if (mode === "search" && searchQuery)
    pageTitle = `SEARCH: "${searchQuery}"`;

  const saleData = mode === "sale" ? (initialData as SaleData | null) : null;
  const saleGroupCount = saleData?.groups.length ?? 0;
  const saleIndividualCount = saleData?.individualProducts.length ?? 0;
  const saleTotalCount = saleGroupCount + saleIndividualCount;

  return (
    <>
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-lg font-semibold tracking-wide uppercase">
            {pageTitle}
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            {mode === "sale"
              ? `${saleTotalCount} ${saleTotalCount === 1 ? "item" : "items"} on sale`
              : `${total} ${total === 1 ? "item" : "items"}${hasMore ? "+" : ""}`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {mode !== "sale" && (
            <Suspense fallback={null}>
              <SortDropdown />
            </Suspense>
          )}
          <Suspense fallback={null}>
            <ProductFilters
              categories={categories}
              sizes={sizes}
              colors={colors}
            />
          </Suspense>
        </div>
      </div>

      {/* Content */}
      {mode === "sale" ? (
        // ── ON SALE VIEW ────────────────────────────────
        saleTotalCount === 0 ? (
          <p className="text-muted-foreground text-sm py-16 text-center">
            No products on sale right now.
          </p>
        ) : (
          <div className="space-y-12">
            {saleData?.groups.map((group) => (
              <div key={group._id} className="space-y-4">
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
                {group.products.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No available products in this group.
                  </p>
                ) : (
                  <ProductGrid products={group.products} />
                )}
              </div>
            ))}

            {(saleData?.individualProducts.length ?? 0) > 0 && (
              <div className="space-y-4">
                {(saleData?.groups.length ?? 0) > 0 && (
                  <div className="flex items-center gap-3 border-b pb-3">
                    <Tag className="h-4 w-4 text-destructive flex-shrink-0" />
                    <h2 className="text-sm font-semibold tracking-wide uppercase">
                      More on Sale
                    </h2>
                  </div>
                )}
                <ProductGrid products={saleData?.individualProducts ?? []} />
              </div>
            )}
          </div>
        )
      ) : (
        // ── REGULAR / SEARCH VIEW ─────────────────────────
        <>
          {products.length === 0 ? (
            <p className="text-muted-foreground text-sm py-16 text-center">
              {mode === "search"
                ? `No results for "${searchQuery}".`
                : "No products found."}
            </p>
          ) : (
            <>
              <ProductGrid products={products} />

              {/* Load more */}
              {hasMore && (
                <div className="flex justify-center mt-10">
                  <button
                    className="border border-border px-8 py-3 text-xs font-semibold uppercase tracking-wider hover:bg-muted transition-colors disabled:opacity-50"
                    onClick={() => setLimit((l) => l + INITIAL_LIMIT)}
                    disabled={isLoadingMore}
                  >
                    {isLoadingMore ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading…
                      </span>
                    ) : (
                      "Load More"
                    )}
                  </button>
                </div>
              )}

              {isLoadingMore && !hasMore && (
                <div className="flex justify-center mt-10">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              )}
            </>
          )}
        </>
      )}
    </>
  );
}
