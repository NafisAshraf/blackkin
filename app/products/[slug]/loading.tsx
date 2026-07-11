import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import ProductDetailSkeleton from "@/components/products/ProductDetailSkeleton";

export default function ProductDetailLoading() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <ProductDetailSkeleton />
      <Footer />
    </div>
  );
}
