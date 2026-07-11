import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import CatalogSkeleton from "@/components/products/CatalogSkeleton";

export default function ProductsLoading() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <CatalogSkeleton />
      <Footer />
    </div>
  );
}
