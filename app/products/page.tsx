"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { usePaginatedQuery, useQuery } from "convex/react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import ProductFilters from "@/components/products/ProductFilters";
import SearchBar from "@/components/products/SearchBar";
import ProductCard from "@/components/products/ProductCard";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Loader2, SlidersHorizontal, ChevronDown, Tag } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

interface ProductMedia {
  storageId: string;
  type: "image" | "video" | "model3d";
  sortOrder: number;
}

interface ListProduct {
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
  media: ProductMedia[];
  tags?: Array<{ _id: string; name: string; slug: string }>;
}

function ProductCardWithImage({ product }: { product: ListProduct }) {
  const firstImage = product.media.find((m) => m.type === "image");
  const imageUrl = useQuery(
    api.files.getUrl,
    firstImage ? { storageId: firstImage.storageId } : "skip"
  );

  return <ProductCard product={product} imageUrl={imageUrl ?? null} />;
}

function ProductsContent() {
  const searchParams = useSearchParams();

  const q = searchParams.get("q") ?? "";
  const categoryId = searchParams.get("categoryId") ?? "";
  const tagId = searchParams.get("tagId") ?? "";
  const size = searchParams.get("size") ?? "";
  const color = searchParams.get("color") ?? "";
  const minPriceStr = searchParams.get("minPrice") ?? "";
  const maxPriceStr = searchParams.get("maxPrice") ?? "";
  const minPrice = minPriceStr ? Number(minPriceStr) : undefined;
  const maxPrice = maxPriceStr ? Number(maxPriceStr) : undefined;
  const onSale = searchParams.get("onSale") === "true";

  const categories = useQuery(api.categories.list) ?? [];
  const sizes = useQuery(api.platformConfig.listSizes) ?? [];
  const colors = useQuery(api.platformConfig.listColors) ?? [];
  const tags = useQuery(api.tags.list) ?? [];

  // On Sale view — non-paginated, structured query
  const saleData = useQuery(api.products.listOnSale, onSale ? {} : "skip");

  const searchResults = usePaginatedQuery(
    api.products.search,
    !onSale && q
      ? { query: q, ...(categoryId ? { categoryId: categoryId as Id<"categories"> } : {}) }
      : "skip",
    { initialNumItems: 24 }
  );

  const filteredResults = usePaginatedQuery(
    api.products.listFiltered,
    !onSale && !q
      ? {
          ...(categoryId ? { categoryId: categoryId as Id<"categories"> } : {}),
          ...(tagId ? { tagId: tagId as Id<"tags"> } : {}),
          ...(size ? { size } : {}),
          ...(color ? { color } : {}),
          ...(minPrice !== undefined ? { minPrice } : {}),
          ...(maxPrice !== undefined ? { maxPrice } : {}),
        }
      : "skip",
    { initialNumItems: 24 }
  );

  const { results, status, loadMore } = q ? searchResults : filteredResults;
  const products = (results ?? []) as ListProduct[];
  const isLoading = !onSale && status === "LoadingFirstPage";

  const filtersPanel = (
    <ProductFilters
      categories={categories}
      sizes={sizes}
      colors={colors}
      tags={tags}
    />
  );

  // Determine page title
  let pageTitle = onSale ? "SALE" : "CATALOG";
  const tagParam = searchParams.get("tag") ?? tagId;
  if (!onSale && tagParam) {
    if (tagParam.includes("new")) pageTitle = "NEW ARRIVALS";
    else if (tagParam.includes("sale")) pageTitle = "SALE";
  }

  // ── ON SALE view ───────────────────────────────────────────
  const saleGroupCount = (saleData?.groups ?? []).length;
  const saleIndividualCount = (saleData?.individualProducts ?? []).length;
  const saleTotalCount = saleGroupCount + saleIndividualCount;

  return (
    <div className="min-h-screen">
      <Navbar />

      <main className="w-full px-6 lg:px-10 py-8">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-lg font-semibold tracking-wide uppercase">{pageTitle}</h1>
            {onSale ? (
              saleData !== undefined && (
                <p className="text-xs text-muted-foreground mt-1">
                  {saleTotalCount} {saleTotalCount === 1 ? "item" : "items"} on sale
                </p>
              )
            ) : (
              !isLoading && (
                <p className="text-xs text-muted-foreground mt-1">
                  {products.length} {products.length === 1 ? "item" : "items"}
                  {status === "CanLoadMore" ? "+" : ""}
                </p>
              )
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* Sort (visual only for now — hidden on sale page) */}
            {!onSale && (
              <div className="hidden md:flex items-center gap-1.5 text-xs text-muted-foreground border border-border px-3 py-2 cursor-pointer hover:bg-muted transition-colors">
                <span>Sort: Price, low to high</span>
                <ChevronDown className="h-3 w-3" />
              </div>
            )}

            {/* Mobile filter toggle */}
            <Sheet>
              <SheetTrigger asChild>
                <button className="flex items-center gap-2 text-xs font-medium border border-border px-3 py-2 hover:bg-muted transition-colors">
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  Filter
                </button>
              </SheetTrigger>
              <SheetContent side="left" className="overflow-y-auto w-72">
                <div className="pt-6">{filtersPanel}</div>
              </SheetContent>
            </Sheet>
          </div>
        </div>

        <div className="flex gap-8">
          {/* Desktop sidebar */}
          <aside className="hidden md:block w-52 flex-shrink-0">
            {filtersPanel}
          </aside>

          {/* Product grid / Sale view */}
          <div className="flex-1 min-w-0">
            {/* Search bar (hidden on sale view) */}
            {!onSale && (
              <div className="mb-6">
                <SearchBar defaultValue={q} />
              </div>
            )}

            {onSale ? (
              // ── ON SALE VIEW ──────────────────────────────────────
              saleData === undefined ? (
                <div className="flex items-center justify-center py-32">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : saleTotalCount === 0 ? (
                <p className="text-muted-foreground text-sm py-16 text-center">
                  No products on sale right now.
                </p>
              ) : (
                <div className="space-y-12">
                  {/* Discount groups — shown first */}
                  {saleData.groups.map((group) => (
                    <div key={group._id} className="space-y-4">
                      <div className="flex items-center gap-3 border-b pb-3">
                        <Tag className="h-4 w-4 text-destructive flex-shrink-0" />
                        <div>
                          <h2 className="text-sm font-semibold tracking-wide uppercase">{group.name}</h2>
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
                        <p className="text-sm text-muted-foreground">No available products in this group.</p>
                      ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
                          {group.products.map((product) => (
                            <ProductCardWithImage key={product._id} product={product as ListProduct} />
                          ))}
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Individual sale products — shown after groups */}
                  {saleData.individualProducts.length > 0 && (
                    <div className="space-y-4">
                      {saleData.groups.length > 0 && (
                        <div className="flex items-center gap-3 border-b pb-3">
                          <Tag className="h-4 w-4 text-destructive flex-shrink-0" />
                          <h2 className="text-sm font-semibold tracking-wide uppercase">More on Sale</h2>
                        </div>
                      )}
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
                        {saleData.individualProducts.map((product) => (
                          <ProductCardWithImage key={product._id} product={product as ListProduct} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            ) : (
              // ── REGULAR VIEW ──────────────────────────────────────
              isLoading ? (
                <div className="flex items-center justify-center py-32">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : products.length === 0 ? (
                <p className="text-muted-foreground text-sm py-16 text-center">
                  No products found.
                </p>
              ) : (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
                    {products.map((product) => (
                      <ProductCardWithImage key={product._id} product={product} />
                    ))}
                  </div>

                  {/* Load more */}
                  {status === "CanLoadMore" && (
                    <div className="flex justify-center mt-10">
                      <button
                        className="border border-border px-8 py-3 text-xs font-semibold uppercase tracking-wider hover:bg-muted transition-colors"
                        onClick={() => loadMore(24)}
                      >
                        Load More
                      </button>
                    </div>
                  )}

                  {status === "LoadingMore" && (
                    <div className="flex justify-center mt-10">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  )}
                </>
              )
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

export default function ProductsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <ProductsContent />
    </Suspense>
  );
}
