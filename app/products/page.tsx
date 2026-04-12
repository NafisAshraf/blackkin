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
import { Loader2, SlidersHorizontal, ChevronDown } from "lucide-react";
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

  const categories = useQuery(api.categories.list) ?? [];
  const sizes = useQuery(api.platformConfig.listSizes) ?? [];
  const colors = useQuery(api.platformConfig.listColors) ?? [];
  const tags = useQuery(api.tags.list) ?? [];

  const searchResults = usePaginatedQuery(
    api.products.search,
    q
      ? { query: q, ...(categoryId ? { categoryId: categoryId as Id<"categories"> } : {}) }
      : "skip",
    { initialNumItems: 24 }
  );

  const filteredResults = usePaginatedQuery(
    api.products.listFiltered,
    !q
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
  const isLoading = status === "LoadingFirstPage";

  const filtersPanel = (
    <ProductFilters
      categories={categories}
      sizes={sizes}
      colors={colors}
      tags={tags}
    />
  );

  // Determine page title
  let pageTitle = "CATALOG";
  const tagParam = searchParams.get("tag") ?? tagId;
  if (tagParam) {
    if (tagParam.includes("new")) pageTitle = "NEW ARRIVALS";
    else if (tagParam.includes("sale")) pageTitle = "SALE";
  }

  return (
    <div className="min-h-screen">
      <Navbar />

      <main className="w-full px-6 lg:px-10 py-8">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-lg font-semibold tracking-wide uppercase">{pageTitle}</h1>
            {!isLoading && (
              <p className="text-xs text-muted-foreground mt-1">
                {products.length} {products.length === 1 ? "item" : "items"}
                {status === "CanLoadMore" ? "+" : ""}
              </p>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* Sort (visual only for now) */}
            <div className="hidden md:flex items-center gap-1.5 text-xs text-muted-foreground border border-border px-3 py-2 cursor-pointer hover:bg-muted transition-colors">
              <span>Sort: Price, low to high</span>
              <ChevronDown className="h-3 w-3" />
            </div>

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

          {/* Product grid */}
          <div className="flex-1 min-w-0">
            {/* Search bar */}
            <div className="mb-6">
              <SearchBar defaultValue={q} />
            </div>

            {isLoading ? (
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
