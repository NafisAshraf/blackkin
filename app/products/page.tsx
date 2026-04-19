import { Suspense } from "react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import CatalogContent from "@/components/products/CatalogContent";
import { fetchAuthQuery } from "@/lib/auth-server";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Loader2 } from "lucide-react";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export const dynamic = "force-dynamic";

export default async function ProductsPage({ searchParams }: PageProps) {
  const params = await searchParams;

  const q = typeof params.q === "string" ? params.q : "";
  const categoryId =
    typeof params.categoryId === "string" ? params.categoryId : "";
  const size = typeof params.size === "string" ? params.size : "";
  const color = typeof params.color === "string" ? params.color : "";
  const minPrice =
    typeof params.minPrice === "string" ? Number(params.minPrice) : undefined;
  const maxPrice =
    typeof params.maxPrice === "string" ? Number(params.maxPrice) : undefined;
  const onSale = params.onSale === "true";
  const sortBy = typeof params.sortBy === "string" ? params.sortBy : undefined;

  const LIMIT = 24;

  // Always fetch filter options in parallel
  const [categories, sizes, colors] = await Promise.all([
    fetchAuthQuery(api.categories.list, {}),
    fetchAuthQuery(api.platformConfig.listSizes, {}),
    fetchAuthQuery(api.platformConfig.listColors, {}),
  ]);

  // Fetch products based on mode
  let initialData: unknown;
  let mode: "filtered" | "search" | "sale" = "filtered";

  if (onSale) {
    mode = "sale";
    initialData = await fetchAuthQuery(api.products.listOnSale, {});
  } else if (q) {
    mode = "search";
    initialData = await fetchAuthQuery(api.products.searchSSR, {
      query: q,
      limit: LIMIT,
      ...(categoryId ? { categoryId: categoryId as Id<"categories"> } : {}),
    });
  } else {
    mode = "filtered";
    initialData = await fetchAuthQuery(api.products.listFilteredSSR, {
      ...(categoryId ? { categoryId: categoryId as Id<"categories"> } : {}),
      ...(size ? { size } : {}),
      ...(color ? { color } : {}),
      ...(minPrice !== undefined && !isNaN(minPrice) ? { minPrice } : {}),
      ...(maxPrice !== undefined && !isNaN(maxPrice) ? { maxPrice } : {}),
      ...(sortBy
        ? {
            sortBy: sortBy as
              | "recommended"
              | "price_asc"
              | "price_desc"
              | "newest"
              | "best_selling",
          }
        : {}),
      limit: LIMIT,
    });
  }

  const queryArgs = {
    categoryId: categoryId || undefined,
    size: size || undefined,
    color: color || undefined,
    minPrice: minPrice !== undefined && !isNaN(minPrice) ? minPrice : undefined,
    maxPrice: maxPrice !== undefined && !isNaN(maxPrice) ? maxPrice : undefined,
    sortBy: sortBy || undefined,
  };

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="w-full px-6 lg:px-10 py-8">
        <Suspense
          fallback={
            <div className="flex items-center justify-center py-32">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          }
        >
          <CatalogContent
            mode={mode}
            initialData={
              initialData as Parameters<typeof CatalogContent>[0]["initialData"]
            }
            categories={
              (categories ?? []) as Parameters<
                typeof CatalogContent
              >[0]["categories"]
            }
            sizes={
              (sizes ?? []) as Parameters<typeof CatalogContent>[0]["sizes"]
            }
            colors={
              (colors ?? []) as Parameters<typeof CatalogContent>[0]["colors"]
            }
            queryArgs={queryArgs}
            searchQuery={q}
          />
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}
