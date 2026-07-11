import { unstable_cache } from "next/cache";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";

const REVALIDATE_SECONDS = 900;

export const STOREFRONT_CACHE_TAGS = {
  shell: "storefront-shell",
  home: "storefront-home",
  catalog: "storefront-catalog",
  products: "storefront-products",
  slugs: "storefront-slugs",
} as const;

export const getStorefrontShell = unstable_cache(
  async () => fetchQuery(api.storefront.getShell, {}),
  ["storefront-shell"],
  {
    revalidate: REVALIDATE_SECONDS,
    tags: [STOREFRONT_CACHE_TAGS.shell],
  },
);

export const getStorefrontHome = unstable_cache(
  async () => fetchQuery(api.storefront.getHomePage, {}),
  ["storefront-home"],
  {
    revalidate: REVALIDATE_SECONDS,
    tags: [STOREFRONT_CACHE_TAGS.home],
  },
);

export const getStorefrontCatalog = unstable_cache(
  async () => fetchQuery(api.storefront.getCatalog, {}),
  ["storefront-catalog"],
  {
    revalidate: REVALIDATE_SECONDS,
    tags: [STOREFRONT_CACHE_TAGS.catalog],
  },
);

export const getStorefrontProduct = unstable_cache(
  async (slug: string) => fetchQuery(api.storefront.getProductPage, { slug }),
  ["storefront-product"],
  {
    revalidate: REVALIDATE_SECONDS,
    tags: [STOREFRONT_CACHE_TAGS.products],
  },
);

export const getStorefrontProductSlugs = unstable_cache(
  async () => fetchQuery(api.storefront.listProductSlugs, {}),
  ["storefront-product-slugs"],
  {
    revalidate: REVALIDATE_SECONDS,
    tags: [STOREFRONT_CACHE_TAGS.slugs],
  },
);
