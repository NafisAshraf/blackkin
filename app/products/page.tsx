import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import CatalogContent from "@/components/products/CatalogContent";
import { resolveProductCardMedia } from "@/lib/storefront-media";
import { getStorefrontCatalog } from "@/lib/storefront-cache";

export const revalidate = 900;

export default async function ProductsPage() {
  const snapshot = await getStorefrontCatalog();
  const products = snapshot.products.map(resolveProductCardMedia);
  const sale = {
    groups: snapshot.sale.groups.map((group) => ({
      ...group,
      products: group.products.map(resolveProductCardMedia),
    })),
    individualProducts: snapshot.sale.individualProducts.map(
      resolveProductCardMedia,
    ),
  };

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="w-full max-w-[1500px] mx-auto px-6 lg:px-10 pt-12 pb-48">
        <CatalogContent
          products={products}
          sale={sale}
          categories={snapshot.categories}
          sizes={snapshot.sizes}
          colors={snapshot.colors}
        />
      </main>
      <Footer />
    </div>
  );
}
