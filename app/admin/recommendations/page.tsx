"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { SortableList } from "@/components/admin/SortableList";
import { ProductPicker } from "@/components/admin/ProductPicker";
import { RowActionsMenu } from "@/components/admin/RowActionsMenu";

// ─── Types ────────────────────────────────────────────────────

type RecType = "best_sellers" | "new_arrivals" | "also_like" | "also_bought";

// ─── Page ─────────────────────────────────────────────────────

export default function RecommendationsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Recommendations</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage product recommendations. Best Sellers and New Arrivals show on the homepage (top 3 displayed). Also Like shows on product pages. Also Bought shows at checkout.
        </p>
      </div>

      <Tabs defaultValue="best_sellers">
        <TabsList className="grid grid-cols-4 w-full max-w-2xl">
          <TabsTrigger value="best_sellers">Best Sellers</TabsTrigger>
          <TabsTrigger value="new_arrivals">New Arrivals</TabsTrigger>
          <TabsTrigger value="also_like">Also Like</TabsTrigger>
          <TabsTrigger value="also_bought">Also Bought</TabsTrigger>
        </TabsList>

        <TabsContent value="best_sellers" className="mt-4">
          <RecSection type="best_sellers" showTop3Badge />
        </TabsContent>
        <TabsContent value="new_arrivals" className="mt-4">
          <RecSection type="new_arrivals" showTop3Badge />
        </TabsContent>
        <TabsContent value="also_like" className="mt-4">
          <RecSection type="also_like" />
        </TabsContent>
        <TabsContent value="also_bought" className="mt-4">
          <RecSection type="also_bought" showForSize />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── RecSection ───────────────────────────────────────────────

function RecSection({
  type,
  showTop3Badge = false,
  showForSize = false,
}: {
  type: RecType;
  showTop3Badge?: boolean;
  showForSize?: boolean;
}) {
  const recs = useQuery(api.recommendations.listByType, { type });
  const sizes = useQuery(api.platformConfig.listSizes);

  const addAtTop = useMutation(api.recommendations.addAtTop);
  const addRec = useMutation(api.recommendations.add);
  const removeRec = useMutation(api.recommendations.remove);
  const reorder = useMutation(api.recommendations.reorder);

  const [selectedProduct, setSelectedProduct] = useState<{ id: Id<"products">; name: string } | null>(null);
  const [forSize, setForSize] = useState("_all");
  const [adding, setAdding] = useState(false);
  const [reordering, setReordering] = useState(false);

  const isFeaturedType = type === "best_sellers" || type === "new_arrivals";

  async function handleAdd() {
    if (!selectedProduct) {
      toast.error("Select a product first");
      return;
    }
    setAdding(true);
    try {
      if (isFeaturedType) {
        await addAtTop({
          type: type as "best_sellers" | "new_arrivals",
          recommendedProductId: selectedProduct.id,
        });
      } else {
        await addRec({
          type,
          recommendedProductId: selectedProduct.id,
          forSize: showForSize && forSize !== "_all" ? forSize : undefined,
        });
      }
      toast.success(`Added "${selectedProduct.name}"`);
      setSelectedProduct(null);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to add");
    } finally {
      setAdding(false);
    }
  }

  async function handleReorder(reordered: { id: string; sortOrder: number }[]) {
    if (reordering) return;
    setReordering(true);
    try {
      await reorder({
        items: reordered.map((r) => ({
          id: r.id as Id<"productRecommendations">,
          sortOrder: r.sortOrder,
        })),
      });
    } catch {
      toast.error("Failed to reorder");
    } finally {
      setReordering(false);
    }
  }

  return (
    <div className="space-y-4">
      {showForSize && (
        <p className="text-sm text-muted-foreground">
          Optionally specify a size. When a customer has that size in their cart, these products appear.
        </p>
      )}

      {/* Add form */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">
            {isFeaturedType ? "Add to top of section" : "Add recommendation"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3 items-end flex-wrap">
            <div className="space-y-1 flex-1 min-w-52">
              <Label className="text-xs">Product</Label>
              <ProductPicker
                onSelect={(p) => setSelectedProduct(p)}
                placeholder="Search products…"
              />
              {selectedProduct && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Selected: <span className="font-medium text-foreground">{selectedProduct.name}</span>
                </p>
              )}
            </div>
            {showForSize && (
              <div className="space-y-1">
                <Label className="text-xs">For Size</Label>
                <Select value={forSize} onValueChange={setForSize}>
                  <SelectTrigger className="w-32 h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_all">All Sizes</SelectItem>
                    {(sizes ?? []).map((s) => (
                      <SelectItem key={s._id} value={s.name}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <Button size="sm" onClick={handleAdd} disabled={adding || !selectedProduct}>
              {adding ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <><Plus className="h-4 w-4 mr-1" />Add</>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* List */}
      <div className="rounded-md border divide-y">
        {recs === undefined ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : recs.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            No recommendations yet
          </div>
        ) : (
          <SortableList
            items={recs}
            onReorder={handleReorder}
            renderItem={(rec, dragHandle) => (
              <div className="flex items-center gap-3 px-4 py-3 bg-background">
                {dragHandle}
                <div className="flex-1 min-w-0 flex items-center gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{rec.productName}</p>
                    {rec.forSize && (
                      <p className="text-xs text-muted-foreground">Size: {rec.forSize}</p>
                    )}
                  </div>
                  {showTop3Badge && rec.sortOrder <= 2 && (
                    <Badge variant="secondary" className="text-xs shrink-0">
                      Shown on homepage
                    </Badge>
                  )}
                </div>
                <RowActionsMenu
                  actions={[
                    {
                      label: "Remove",
                      icon: Trash2,
                      variant: "destructive",
                      onClick: () =>
                        removeRec({ id: rec._id })
                          .then(() => toast.success("Removed"))
                          .catch((e) => toast.error(e.message)),
                    },
                  ]}
                />
              </div>
            )}
          />
        )}
      </div>
    </div>
  );
}
