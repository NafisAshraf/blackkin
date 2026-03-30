"use client";

import { useState, useEffect } from "react";
import { usePaginatedQuery, useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { toast } from "sonner";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, PlusCircle, Pencil, ToggleLeft, ToggleRight } from "lucide-react";
import { RowActionsMenu } from "@/components/admin/RowActionsMenu";

export default function AdminProductsPage() {
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [togglingId, setTogglingId] = useState<Id<"products"> | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setSearchQuery(searchInput), 500);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const { results, status, loadMore } = usePaginatedQuery(
    api.products.listAllAdmin,
    { searchQuery: searchQuery || undefined },
    { initialNumItems: 20 }
  );

  const categories = useQuery(api.categories.list);
  const toggleActive = useMutation(api.products.toggleActive);

  const categoryMap = new Map((categories ?? []).map((c) => [c._id, c.name]));

  async function handleToggleActive(id: Id<"products">, currentIsActive: boolean) {
    setTogglingId(id);
    try {
      await toggleActive({ id, isActive: !currentIsActive });
      toast.success(`Product ${!currentIsActive ? "activated" : "deactivated"}`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to update product");
    } finally {
      setTogglingId(null);
    }
  }

  const isDone = status === "Exhausted";
  const isLoadingMore = status === "LoadingMore";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Products</h1>
        <Button asChild>
          <Link href="/admin/products/new">
            <PlusCircle className="mr-2 h-4 w-4" />
            New Product
          </Link>
        </Button>
      </div>

      <Input
        placeholder="Search products..."
        value={searchInput}
        onChange={(e) => setSearchInput(e.target.value)}
        className="max-w-sm"
      />

      {status === "LoadingFirstPage" ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Base Price</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right w-16">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      No products found.
                    </TableCell>
                  </TableRow>
                ) : (
                  results.map((product) => (
                    <TableRow key={product._id}>
                      <TableCell className="font-medium">{product.name}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {categoryMap.get(product.categoryId) ?? "—"}
                      </TableCell>
                      <TableCell>৳{product.basePrice.toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge variant={product.isActive ? "default" : "secondary"}>
                          {product.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <RowActionsMenu
                          actions={[
                            {
                              label: "Edit",
                              icon: Pencil,
                              onClick: () =>
                                (window.location.href = `/admin/products/${product._id}`),
                            },
                            {
                              label:
                                togglingId === product._id
                                  ? "Updating…"
                                  : product.isActive
                                  ? "Deactivate"
                                  : "Activate",
                              icon: product.isActive ? ToggleLeft : ToggleRight,
                              disabled: togglingId === product._id,
                              separator: true,
                              onClick: () =>
                                handleToggleActive(product._id, product.isActive),
                            },
                          ]}
                        />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {!isDone && (
            <div className="flex justify-center pt-2">
              <Button variant="outline" onClick={() => loadMore(20)} disabled={isLoadingMore}>
                {isLoadingMore ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading…
                  </>
                ) : (
                  "Load More"
                )}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
