import ProductCard from "./ProductCard";
import { Id } from "@/convex/_generated/dataModel";

interface Product {
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
  media: Array<{
    storageId: string;
    type: "image" | "video";
    sortOrder: number;
  }>;
  imageUrl?: string | null;
}

interface ProductGridProps {
  products: Product[];
}

export default function ProductGrid({ products }: ProductGridProps) {
  if (products.length === 0) {
    return (
      <p className="text-muted-foreground text-sm py-8 text-center">No products found.</p>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {products.map((product) => (
        <ProductCard key={product._id} product={product} imageUrl={product.imageUrl} />
      ))}
    </div>
  );
}
