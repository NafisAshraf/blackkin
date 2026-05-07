"use client";

import { useState, useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Loader2, Package, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

export type PickerProduct = {
  _id: Id<"products">;
  name: string;
  slug: string;
  basePrice: number;
  effectivePrice: number;
  discountAmount: number;
  status: "draft" | "active" | "scheduled" | "archived";
  imageUrl: string | null;
  totalStock: number;
  categoryName: string | null;
  variants: Array<{
    _id: Id<"productVariants">;
    size: string;
    color?: string;
    stock: number;
    priceOverride?: number;
  }>;
};

interface ProductPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  /** Set of product IDs already added — shown with "Added" badge, non-selectable */
  alreadySelectedIds?: Set<string>;
  onSelect: (product: PickerProduct) => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTk(amount: number) {
  return "Tk " + amount.toLocaleString("en-BD");
}

function StockBadge({ stock }: { stock: number }) {
  if (stock === 0) {
    return (
      <span className="text-[10px] font-medium text-red-500">Out of stock</span>
    );
  }
  if (stock <= 5) {
    return (
      <span className="text-[10px] font-medium text-amber-500">
        {stock} left
      </span>
    );
  }
  return (
    <span className="text-[10px] text-muted-foreground">{stock} in stock</span>
  );
}

// ─── Product Card ─────────────────────────────────────────────────────────────

function ProductCard({
  product,
  isAdded,
  onClick,
}: {
  product: PickerProduct;
  isAdded: boolean;
  onClick: () => void;
}) {
  const hasDiscount = product.discountAmount > 0;

  return (
    <button
      type="button"
      disabled={isAdded}
      onClick={onClick}
      className={cn(
        "group relative flex flex-col text-left border rounded-lg overflow-hidden transition-all",
        "hover:border-foreground/40 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        isAdded
          ? "opacity-60 cursor-not-allowed border-border"
          : "cursor-pointer border-border",
      )}
    >
      {/* Thumbnail */}
      <div className="aspect-square w-full bg-muted overflow-hidden relative">
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Package className="h-8 w-8 text-muted-foreground/30" />
          </div>
        )}
        {isAdded && (
          <div className="absolute inset-0 bg-background/70 flex items-center justify-center">
            <Badge variant="secondary" className="text-[10px]">
              Added
            </Badge>
          </div>
        )}
        {product.status !== "active" && (
          <Badge
            variant="outline"
            className="absolute top-1 left-1 text-[9px] capitalize bg-background/80"
          >
            {product.status}
          </Badge>
        )}
      </div>

      {/* Info */}
      <div className="p-2 space-y-0.5 flex-1 flex flex-col">
        <p className="text-xs font-medium leading-snug line-clamp-2">
          {product.name}
        </p>
        {product.categoryName && (
          <p className="text-[10px] text-muted-foreground truncate">
            {product.categoryName}
          </p>
        )}
        <div className="flex items-baseline gap-1 mt-0.5">
          <span className="text-xs font-semibold">
            {formatTk(product.effectivePrice)}
          </span>
          {hasDiscount && (
            <span className="text-[10px] text-muted-foreground line-through">
              {formatTk(product.basePrice)}
            </span>
          )}
        </div>
        <div className="mt-auto pt-1">
          <StockBadge stock={product.totalStock} />
        </div>
      </div>
    </button>
  );
}

// ─── Main Dialog ─────────────────────────────────────────────────────────────

export function ProductPickerDialog({
  open,
  onOpenChange,
  title,
  description,
  alreadySelectedIds,
  onSelect,
}: ProductPickerDialogProps) {
  const [search, setSearch] = useState("");

  const allProducts = useQuery(api.products.listAllForPicker);

  const filtered = useMemo(() => {
    if (!allProducts) return [];
    const q = search.trim().toLowerCase();
    if (!q) return allProducts;
    return allProducts.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.slug.toLowerCase().includes(q),
    );
  }, [allProducts, search]);

  function handleSelect(product: PickerProduct) {
    onSelect(product);
    onOpenChange(false);
    setSearch("");
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) setSearch("");
        onOpenChange(v);
      }}
    >
      <DialogContent className="sm:max-w-5xl w-full max-h-[88vh] flex flex-col gap-0 p-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-3 border-b shrink-0">
          <DialogTitle>{title}</DialogTitle>
          {description && (
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          )}
        </DialogHeader>

        {/* Search bar */}
        <div className="px-5 py-3 border-b shrink-0">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search by name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-sm"
              autoFocus
            />
          </div>
        </div>

        {/* Product grid */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {allProducts === undefined ? (
            <div className="flex flex-col items-center justify-center h-40 gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <p className="text-sm">Loading products…</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-2 text-muted-foreground">
              <Package className="h-6 w-6" />
              <p className="text-sm">
                {search ? "No products match your search" : "No products found"}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {filtered.map((product) => (
                <ProductCard
                  key={product._id}
                  product={product}
                  isAdded={alreadySelectedIds?.has(product._id) ?? false}
                  onClick={() => handleSelect(product)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer count */}
        {allProducts !== undefined && (
          <div className="px-5 py-2.5 border-t shrink-0 text-[11px] text-muted-foreground">
            {search
              ? `${filtered.length} of ${allProducts.length} products`
              : `${allProducts.length} products`}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Variant Picker Dialog ─────────────────────────────────────────────────────
// Separate component for the "People Also Bought" flow where a variant must be
// chosen. Step 1 = product grid, Step 2 = variants for a specific size.

interface VariantPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  forSize: string;
  /** Called when admin clicks Add on a specific variant */
  onAddVariant: (variantId: Id<"productVariants">) => Promise<void>;
}

export function VariantPickerDialog({
  open,
  onOpenChange,
  forSize,
  onAddVariant,
}: VariantPickerDialogProps) {
  const [search, setSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<PickerProduct | null>(null);
  const [adding, setAdding] = useState<string | null>(null);

  const allProducts = useQuery(api.products.listAllForPicker);

  const variantsForPicker = useQuery(
    api.recommendations.getVariantsForPicker,
    selectedProduct ? { productId: selectedProduct._id, size: forSize } : "skip",
  );

  const filteredProducts = useMemo(() => {
    if (!allProducts) return [];
    const q = search.trim().toLowerCase();
    if (!q) return allProducts;
    return allProducts.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.slug.toLowerCase().includes(q),
    );
  }, [allProducts, search]);

  function handleClose() {
    setSearch("");
    setSelectedProduct(null);
    setAdding(null);
    onOpenChange(false);
  }

  async function handleAdd(variantId: Id<"productVariants">) {
    setAdding(variantId);
    try {
      await onAddVariant(variantId);
    } finally {
      setAdding(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="sm:max-w-4xl w-full max-h-[88vh] flex flex-col gap-0 p-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-3 border-b shrink-0">
          <DialogTitle>Add Variant — Size {forSize}</DialogTitle>
          {selectedProduct ? (
            <p className="text-xs text-muted-foreground mt-0.5">
              Select a variant from <span className="font-medium text-foreground">{selectedProduct.name}</span>
            </p>
          ) : (
            <p className="text-xs text-muted-foreground mt-0.5">
              Choose a product, then select the {forSize} variant to add
            </p>
          )}
        </DialogHeader>

        {/* Step 1 — Product grid */}
        {!selectedProduct && (
          <>
            <div className="px-5 py-3 border-b shrink-0">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="Search by name…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 h-8 text-sm"
                  autoFocus
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              {allProducts === undefined ? (
                <div className="flex flex-col items-center justify-center h-40 gap-2 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <p className="text-sm">Loading products…</p>
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 gap-2 text-muted-foreground">
                  <Package className="h-6 w-6" />
                  <p className="text-sm">No products match your search</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {filteredProducts.map((product) => (
                    <ProductCard
                      key={product._id}
                      product={product}
                      isAdded={false}
                      onClick={() => setSelectedProduct(product)}
                    />
                  ))}
                </div>
              )}
            </div>

            {allProducts !== undefined && (
              <div className="px-5 py-2.5 border-t shrink-0 text-[11px] text-muted-foreground">
                {search
                  ? `${filteredProducts.length} of ${allProducts.length} products`
                  : `${allProducts.length} products`}
              </div>
            )}
          </>
        )}

        {/* Step 2 — Variant list */}
        {selectedProduct && (
          <div className="flex-1 overflow-y-auto flex flex-col">
            <div className="px-5 py-3 border-b shrink-0">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs -ml-2"
                onClick={() => setSelectedProduct(null)}
              >
                <ChevronLeft className="h-3.5 w-3.5 mr-1" />
                Back to Products
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2">
              {variantsForPicker === undefined ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              ) : variantsForPicker.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No Size {forSize} variants available for this product.
                </p>
              ) : (
                variantsForPicker.map((variant) => {
                  const isOOS = variant.stock === 0;
                  const isDisabled = isOOS || variant.alreadyAdded || adding === variant._id;

                  return (
                    <div
                      key={variant._id}
                      className={cn(
                        "flex items-center justify-between p-3 border rounded-md",
                        isDisabled ? "opacity-60 bg-muted/20" : "bg-background",
                      )}
                    >
                      <div>
                        <p className="text-sm font-medium">
                          {variant.color ?? "No color"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {isOOS
                            ? "Out of stock"
                            : `${variant.stock} in stock`}
                        </p>
                      </div>
                      {variant.alreadyAdded ? (
                        <Badge variant="secondary" className="text-[10px]">
                          Already Added
                        </Badge>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          disabled={isDisabled}
                          onClick={() => handleAdd(variant._id)}
                        >
                          {adding === variant._id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : isOOS ? (
                            "Out of stock"
                          ) : (
                            "Add"
                          )}
                        </Button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
