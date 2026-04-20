"use client";

import { Suspense, useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { toast } from "sonner";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  LayoutGrid,
  List,
  Plus,
  Pencil,
  Trash2,
  ToggleLeft,
  ToggleRight,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Tags,
  FolderOpen,
  Percent,
  Star,
  ArrowUpDown,
  X,
  Loader2,
} from "lucide-react";
import { ProductGridCard } from "@/components/admin/ProductGridCard";
import {
  SortableProductGrid,
  type SortableProductItem,
} from "@/components/admin/SortableProductGrid";
import { SortableProductTable } from "@/components/admin/SortableProductTable";
import { AddProductCard } from "@/components/admin/AddProductCard";
import { QuickCategoryDialog } from "@/components/admin/QuickCategoryDialog";
import { QuickTagDialog } from "@/components/admin/QuickTagDialog";
import { DiscountGroupDialog } from "@/components/admin/DiscountGroupDialog";
import { RowActionsMenu } from "@/components/admin/RowActionsMenu";
import { ProductPicker } from "@/components/admin/ProductPicker";
import { SortableList } from "@/components/admin/SortableList";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// ─── Types ────────────────────────────────────────────────────────────────────

type ProductStatus = "draft" | "active" | "scheduled" | "archived";
type ViewMode = "grid" | "table";
type TabId = "all" | "categories" | "tags" | "discounts" | "recommendations";

const STATUS_BADGE: Record<
  ProductStatus,
  {
    label: string;
    variant: "default" | "secondary" | "outline" | "destructive";
  }
> = {
  active: { label: "Active", variant: "default" },
  draft: { label: "Draft", variant: "secondary" },
  scheduled: { label: "Scheduled", variant: "outline" },
  archived: { label: "Archived", variant: "destructive" },
};

// ─── Skeleton loaders ─────────────────────────────────────────────────────────

function GridSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="aspect-square w-full rounded-lg" />
          <Skeleton className="h-3 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      ))}
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Regular Price</TableHead>
            <TableHead>Sale Price</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-16" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 5 }).map((_, i) => (
            <TableRow key={i}>
              {Array.from({ length: 6 }).map((__, j) => (
                <TableCell key={j}>
                  <Skeleton className="h-4 w-full" />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ─── VariantPickerDialog ──────────────────────────────────────────────────────

interface VariantPickerDialogProps {
  open: boolean;
  onClose: () => void;
  forSize: string;
  onAdd: (variantId: Id<"productVariants">) => Promise<void>;
}

function VariantPickerDialog({
  open,
  onClose,
  forSize,
  onAdd,
}: VariantPickerDialogProps) {
  const [selectedProduct, setSelectedProduct] = useState<{
    id: Id<"products">;
    name: string;
  } | null>(null);
  const [adding, setAdding] = useState<string | null>(null);

  const variants = useQuery(
    api.recommendations.getVariantsForPicker,
    selectedProduct ? { productId: selectedProduct.id, size: forSize } : "skip",
  );

  async function handleAdd(variantId: Id<"productVariants">) {
    setAdding(variantId);
    try {
      await onAdd(variantId);
      toast.success("Variant added");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to add");
    } finally {
      setAdding(null);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) {
          onClose();
          setSelectedProduct(null);
        }
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Variant — Size {forSize}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {!selectedProduct ? (
            <div className="space-y-2">
              <Label className="text-sm">Search Product</Label>
              <ProductPicker
                onSelect={(p) => setSelectedProduct(p)}
                placeholder="Search products…"
              />
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">{selectedProduct.name}</p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedProduct(null)}
                  className="h-7 text-xs"
                >
                  Change
                </Button>
              </div>
              {variants === undefined ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              ) : variants.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No {forSize} variants for this product.
                </p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {variants.map((v) => (
                    <div
                      key={v._id}
                      className="flex items-center justify-between p-2.5 border rounded-md"
                    >
                      <div>
                        <p className="text-sm">{v.color ?? "No color"}</p>
                        <p className="text-xs text-muted-foreground">
                          {v.stock} in stock
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={
                          adding === v._id || v.stock === 0 || v.alreadyAdded
                        }
                        onClick={() => handleAdd(v._id)}
                        className="h-7 text-xs"
                      >
                        {adding === v._id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : v.alreadyAdded ? (
                          "Added"
                        ) : (
                          "Add"
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── AlsoBoughtAdminSection ───────────────────────────────────────────────────

function AlsoBoughtAdminSection() {
  const sizeGroups = useQuery(api.recommendations.listAlsoBoughtBySize);
  const platformSizes = useQuery(api.platformConfig.listSizes);
  const removeRec = useMutation(api.recommendations.remove);
  const addVariantRec = useMutation(api.recommendations.addVariant);
  const reorderForSize = useMutation(
    api.recommendations.reorderAlsoBoughtForSize,
  );
  const [pickerSize, setPickerSize] = useState<string | null>(null);

  async function handleAddVariant(
    variantId: Id<"productVariants">,
    forSize: string,
  ) {
    await addVariantRec({ recommendedVariantId: variantId, forSize });
  }

  const allSizes = platformSizes ?? [];

  // Build a map from size name -> items
  const sizeMap = new Map<
    string,
    NonNullable<typeof sizeGroups>[number]["items"]
  >();
  for (const group of sizeGroups ?? []) {
    sizeMap.set(group.forSize, group.items);
  }

  if (sizeGroups === undefined || platformSizes === undefined) {
    return <Skeleton className="h-32 w-full rounded-md" />;
  }

  if (allSizes.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        Configure sizes in Settings first.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {allSizes.map((size) => {
        const items = sizeMap.get(size.name) ?? [];

        async function handleReorder(
          reordered: { id: string; sortOrder: number }[],
        ) {
          try {
            await reorderForSize({
              forSize: size.name,
              items: reordered.map((item) => ({
                id: item.id as Id<"productRecommendations">,
                sortOrder: item.sortOrder,
              })),
            });
          } catch (e: unknown) {
            toast.error(e instanceof Error ? e.message : "Failed to reorder");
          }
        }

        return (
          <div key={size._id} className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Size {size.name}</h3>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() => setPickerSize(size.name)}
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Add Variant
              </Button>
            </div>
            {items.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No variants added for this size yet.
              </p>
            ) : (
              <div className="space-y-2">
                <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                  Drag to reorder within size {size.name}
                </p>
                <div className="rounded-md border divide-y">
                  <SortableList
                    items={items}
                    onReorder={handleReorder}
                    renderItem={(item, dragHandle) => (
                      <div className="flex items-center gap-3 px-3 py-2.5 bg-background">
                        {dragHandle}
                        <div className="h-12 w-12 overflow-hidden rounded bg-muted shrink-0">
                          {item.imageUrl ? (
                            <img
                              src={item.imageUrl}
                              alt={item.productName}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">
                              No image
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">
                            {item.productName}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {item.color ?? "No color"} · {item.stock} in stock
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
                          onClick={() =>
                            removeRec({ id: item._id })
                              .then(() => toast.success("Removed"))
                              .catch((e: unknown) =>
                                toast.error(
                                  e instanceof Error ? e.message : "Failed",
                                ),
                              )
                          }
                        >
                          Remove
                        </Button>
                      </div>
                    )}
                  />
                </div>
              </div>
            )}
          </div>
        );
      })}
      {pickerSize && (
        <VariantPickerDialog
          open={true}
          forSize={pickerSize}
          onClose={() => setPickerSize(null)}
          onAdd={(variantId) => handleAddVariant(variantId, pickerSize)}
        />
      )}
    </div>
  );
}

// ─── Recommendations section (embedded) ──────────────────────────────────────

type RecType = "also_like" | "also_bought";

function RecSection({
  type,
  showForSize = false,
}: {
  type: RecType;
  showForSize?: boolean;
}) {
  const recs = useQuery(api.recommendations.listByType, { type });
  const sizes = useQuery(api.platformConfig.listSizes);
  const addRec = useMutation(api.recommendations.add);
  const removeRec = useMutation(api.recommendations.remove);
  const reorder = useMutation(api.recommendations.reorder);
  const [selectedProduct, setSelectedProduct] = useState<{
    id: Id<"products">;
    name: string;
  } | null>(null);
  const [forSize, setForSize] = useState("_all");
  const [adding, setAdding] = useState(false);

  async function handleAdd() {
    if (!selectedProduct) {
      toast.error("Select a product first");
      return;
    }
    setAdding(true);
    try {
      await addRec({
        type,
        recommendedProductId: selectedProduct.id,
        forSize: showForSize && forSize !== "_all" ? forSize : undefined,
      });
      toast.success(`Added "${selectedProduct.name}"`);
      setSelectedProduct(null);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to add");
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="space-y-3">
      {/* Add form */}
      <div className="flex gap-2 items-end flex-wrap p-3 rounded-md border bg-muted/30">
        <div className="flex-1 min-w-48">
          <Label className="text-xs mb-1 block">Add Product</Label>
          <ProductPicker
            onSelect={setSelectedProduct}
            placeholder="Search products…"
          />
        </div>
        {showForSize && (
          <div>
            <Label className="text-xs mb-1 block">For Size</Label>
            <Select value={forSize} onValueChange={setForSize}>
              <SelectTrigger className="w-28 h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">All Sizes</SelectItem>
                {(sizes ?? []).map((s) => (
                  <SelectItem key={s._id} value={s.name}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <Button
          size="sm"
          onClick={handleAdd}
          disabled={adding || !selectedProduct}
        >
          <Plus className="h-4 w-4 mr-1" />
          Add
        </Button>
      </div>

      {/* List */}
      {recs === undefined ? (
        <Skeleton className="h-32 w-full rounded-md" />
      ) : recs.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">
          No recommendations yet
        </p>
      ) : (
        <div className="rounded-md border divide-y">
          <SortableList
            items={recs}
            onReorder={(items) =>
              reorder({
                items: items.map((r) => ({
                  id: r.id as Id<"productRecommendations">,
                  sortOrder: r.sortOrder,
                })),
              }).catch(() => toast.error("Failed to reorder"))
            }
            renderItem={(rec, dragHandle) => (
              <div className="flex items-center gap-3 px-4 py-3 bg-background">
                {dragHandle}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {rec.productName}
                  </p>
                  {rec.forSize && (
                    <p className="text-xs text-muted-foreground">
                      Size: {rec.forSize}
                    </p>
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
        </div>
      )}
    </div>
  );
}

// ─── Main inner component ─────────────────────────────────────────────────────

function AdminProductsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = (searchParams.get("tab") ?? "all") as TabId;
  const showArchived = searchParams.get("archived") === "true";

  // ── View mode (persisted in localStorage) ─────────────────────
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  useEffect(() => {
    const saved = localStorage.getItem("adminProductsView") as ViewMode | null;
    if (saved === "grid" || saved === "table") setViewMode(saved);
  }, []);
  function toggleView(mode: ViewMode) {
    setViewMode(mode);
    localStorage.setItem("adminProductsView", mode);
  }

  // ── Quick dialog state ─────────────────────────────────────────
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [editCategory, setEditCategory] = useState<{
    id: Id<"categories">;
    name: string;
  } | null>(null);
  const [showNewTag, setShowNewTag] = useState(false);
  const [editTag, setEditTag] = useState<{
    id: Id<"tags">;
    name: string;
  } | null>(null);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [editGroup, setEditGroup] = useState<any | null>(null);

  // ── Delete confirm ─────────────────────────────────────────────
  const [deleteProductId, setDeleteProductId] = useState<Id<"products"> | null>(
    null,
  );

  // ── Multi-select ───────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchDeleting, setBatchDeleting] = useState(false);

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  async function handleBatchMoveCategory(categoryId: string) {
    try {
      await Promise.all(
        [...selectedIds].map((id) =>
          updateProduct({
            id: id as Id<"products">,
            categoryId: categoryId as Id<"categories">,
          }),
        ),
      );
      toast.success(`Moved ${selectedIds.size} product(s) to category`);
      clearSelection();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to move products");
    }
  }

  async function handleBatchAddTag(tagId: string) {
    try {
      if (tagId === "none") {
        await Promise.all(
          [...selectedIds].map((id) =>
            assignTags({ productId: id as Id<"products">, tagIds: [] }),
          ),
        );
        toast.success(`Removed tags from ${selectedIds.size} product(s)`);
      } else {
        await Promise.all(
          [...selectedIds].map((id) => {
            const product = (products ?? []).find((p) => p._id === id);
            const currentTagIds = (product?.tagIds ?? []) as Id<"tags">[];
            if (currentTagIds.includes(tagId as Id<"tags">))
              return Promise.resolve();
            return assignTags({
              productId: id as Id<"products">,
              tagIds: [...currentTagIds, tagId as Id<"tags">],
            });
          }),
        );
        toast.success(
          `Tag added to ${selectedIds.size} product${selectedIds.size !== 1 ? "s" : ""}`,
        );
      }
      clearSelection();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to add tag");
    }
  }

  async function handleBatchAddToGroup(groupId: string) {
    try {
      if (groupId === "none") {
        await removeProductsFromAllGroups({
          productIds: Array.from(selectedIds) as Id<"products">[],
        });
        toast.success(
          `Removed ${selectedIds.size} product(s) from discount groups`,
        );
      } else {
        await addProductsToGroup({
          groupId: groupId as Id<"discountGroups">,
          productIds: Array.from(selectedIds) as Id<"products">[],
        });
        toast.success(
          `Added ${selectedIds.size} product${selectedIds.size !== 1 ? "s" : ""} to discount group`,
        );
      }
      clearSelection();
    } catch (e: unknown) {
      toast.error(
        e instanceof Error ? e.message : "Failed to add to discount group",
      );
    }
  }

  async function handleBatchDelete() {
    if (
      !confirm(
        `Delete ${selectedIds.size} selected product${selectedIds.size !== 1 ? "s" : ""}? This cannot be undone.`,
      )
    )
      return;
    setBatchDeleting(true);
    try {
      await Promise.all(
        [...selectedIds].map((id) =>
          removeProduct({ id: id as Id<"products"> }),
        ),
      );
      toast.success(
        `Deleted ${selectedIds.size} product${selectedIds.size !== 1 ? "s" : ""}`,
      );
      clearSelection();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to delete");
    } finally {
      setBatchDeleting(false);
    }
  }

  // ── Collapsible category/tag sections ─────────────────────────
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  function toggleSection(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // ── Data fetching (single query for all product data) ──────────
  const products = useQuery(api.products.listAllAdminFlat);
  const categories = useQuery(api.categories.listAll);
  const tags = useQuery(api.tags.listAll);
  const discountGroups = useQuery(api.discountGroups.listAll);
  const groupMemberships = useQuery(api.discountGroups.listAllGroupMemberships);

  // ── Mutations ──────────────────────────────────────────────────
  const removeProduct = useMutation(api.products.remove);
  const updateStatus = useMutation(api.products.updateStatus);
  const reorderGlobal = useMutation(api.products.reorderGlobal);
  const reorderCategory = useMutation(api.products.reorderCategory);
  const reorderTag = useMutation(api.products.reorderTag);
  const updateProduct = useMutation(api.products.update);
  const assignTags = useMutation(api.products.assignTags);
  const removeCategory = useMutation(api.categories.remove);
  const toggleCategoryActive = useMutation(api.categories.toggleActive);
  const removeTag = useMutation(api.tags.remove);
  const toggleTagActive = useMutation(api.tags.toggleActive);
  const addProductsToGroup = useMutation(api.discountGroups.addProducts);
  const removeProductFromGroup = useMutation(api.discountGroups.removeProduct);
  const removeProductsFromAllGroups = useMutation(
    api.discountGroups.removeProductsFromAllGroups,
  );
  const removeGroup = useMutation(api.discountGroups.remove);
  const toggleGroupActive = useMutation(api.discountGroups.toggleActive);
  const reorderGroups = useMutation(api.discountGroups.reorderGroups);
  const reorderProductsInGroup = useMutation(
    api.discountGroups.reorderProductsInGroup,
  );
  const reorderSaleDiscount = useMutation(api.products.reorderSaleDiscount);

  function setTab(t: TabId) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", t);
    params.delete("archived");
    router.replace(`/admin/products?${params.toString()}`);
  }

  // ── Derived data ───────────────────────────────────────────────
  const now = Date.now();

  const categoryMap = new Map((categories ?? []).map((c) => [c._id, c]));
  const tagMap = new Map((tags ?? []).map((t) => [t._id, t]));

  // Effective status for display (scheduled-past = active)
  function effectiveStatus(p: {
    status: ProductStatus;
    scheduledPublishTime?: number;
  }): ProductStatus {
    if (
      p.status === "scheduled" &&
      p.scheduledPublishTime &&
      p.scheduledPublishTime <= now
    )
      return "active";
    return p.status;
  }

  // Group products by effective status
  const nonArchived = (products ?? []).filter(
    (p) => effectiveStatus(p as any) !== "archived",
  );
  const archived = (products ?? []).filter(
    (p) => effectiveStatus(p as any) === "archived",
  );
  const drafts = nonArchived
    .filter((p) => effectiveStatus(p as any) === "draft")
    .sort((a, b) => a.globalSortOrder - b.globalSortOrder);
  const scheduled = nonArchived
    .filter(
      (p) =>
        (p as any).status === "scheduled" &&
        (!(p as any).scheduledPublishTime ||
          (p as any).scheduledPublishTime > now),
    )
    .sort((a, b) => a.globalSortOrder - b.globalSortOrder);
  const active = nonArchived
    .filter((p) => effectiveStatus(p as any) === "active")
    .sort((a, b) => a.globalSortOrder - b.globalSortOrder);

  // Map of productId → groupIds
  const productGroupMap = new Map<string, string[]>();
  for (const m of groupMemberships ?? []) {
    const arr = productGroupMap.get(m.productId) ?? [];
    arr.push(m.groupId);
    productGroupMap.set(m.productId, arr);
  }

  // ── Handlers ───────────────────────────────────────────────────

  async function handleDelete(id: Id<"products">) {
    try {
      await removeProduct({ id });
      toast.success("Product deleted");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to delete");
    } finally {
      setDeleteProductId(null);
    }
  }

  async function handleStatusChange(
    id: Id<"products">,
    newStatus: ProductStatus,
  ) {
    try {
      await updateStatus({ id, status: newStatus });
      toast.success(`Status updated to ${newStatus}`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to update status");
    }
  }

  // ── Render helpers ─────────────────────────────────────────────

  function ProductTableRow({ p }: { p: any }) {
    const cat = categoryMap.get(p.categoryId);
    const es = effectiveStatus(p);
    const badge = STATUS_BADGE[es];
    return (
      <TableRow>
        <TableCell className="font-medium">
          <Link href={`/admin/products/${p._id}`} className="hover:underline">
            {p.name}
          </Link>
        </TableCell>
        <TableCell className="text-sm text-muted-foreground">
          {cat?.name ?? "—"}
        </TableCell>
        <TableCell>৳{p.basePrice.toLocaleString()}</TableCell>
        <TableCell>
          {p.effectivePrice < p.basePrice ? (
            <span className="text-destructive font-medium">
              ৳{p.effectivePrice.toLocaleString()}
            </span>
          ) : (
            "—"
          )}
        </TableCell>
        <TableCell>
          <Badge variant={badge.variant}>{badge.label}</Badge>
        </TableCell>
        <TableCell className="text-right">
          <RowActionsMenu
            actions={[
              {
                label: "Edit",
                icon: Pencil,
                onClick: () => router.push(`/admin/products/${p._id}`),
              },
              {
                label: es === "active" ? "Set to Draft" : "Set to Active",
                icon: es === "active" ? ToggleLeft : ToggleRight,
                separator: true,
                onClick: () =>
                  handleStatusChange(
                    p._id,
                    es === "active" ? "draft" : "active",
                  ),
              },
              {
                label: "Delete",
                icon: Trash2,
                variant: "destructive",
                separator: true,
                onClick: () => setDeleteProductId(p._id),
              },
            ]}
          />
        </TableCell>
      </TableRow>
    );
  }

  function ProductGroupSection({
    label,
    prods,
    sectionKey,
    addHref,
    onReorder,
    onPublish,
  }: {
    label: string;
    prods: any[];
    sectionKey: string;
    addHref: string;
    onReorder?: (items: { id: Id<"products">; sortOrder: number }[]) => void;
    onPublish?: (id: Id<"products">) => void;
  }) {
    const isCollapsed = collapsed.has(sectionKey);
    return (
      <div className="space-y-3">
        <button
          onClick={() => toggleSection(sectionKey)}
          className="flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors w-full text-left"
        >
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
          {label}
          <span className="text-xs font-normal ml-1 bg-muted px-1.5 py-0.5 rounded">
            {prods.length}
          </span>
        </button>
        {!isCollapsed &&
          (viewMode === "grid" ? (
            (() => {
              const items: SortableProductItem[] = prods.map((p) => ({
                id: p._id,
                name: p.name,
                basePrice: p.basePrice,
                effectivePrice: p.effectivePrice,
                discountAmount: p.discountAmount,
                discountSource: p.discountSource,
                discountGroupName: p.discountGroupName,
                saleDisplayMode: p.saleDisplayMode,
                saleStartMode: p.saleStartMode,
                saleStartTime: p.saleStartTime,
                saleEndMode: p.saleEndMode,
                saleEndTime: p.saleEndTime,
                status: p.status,
                imageUrl: p.imageUrl,
                scheduledPublishTime: p.scheduledPublishTime,
                categoryName: categoryMap.get(p.categoryId as Id<"categories">)
                  ?.name,
                totalStock: (p.variants ?? []).reduce(
                  (sum: number, v: any) => sum + (v.stock ?? 0),
                  0,
                ),
                variantCount: (p.variants ?? []).length,
                tags: (p.tagIds ?? [])
                  .map((id: string) => tagMap.get(id as Id<"tags">)?.name)
                  .filter(Boolean) as string[],
              }));
              return (
                <SortableProductGrid
                  items={items}
                  selectedIds={selectedIds}
                  onToggleSelect={toggleSelect}
                  onReorder={onReorder ?? (() => {})}
                  onPublish={onPublish}
                  prefix={<AddProductCard href={addHref} />}
                />
              );
            })()
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Regular Price</TableHead>
                    <TableHead>Sale Price</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-16" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {prods.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="text-center py-6 text-muted-foreground text-sm"
                      >
                        No products
                      </TableCell>
                    </TableRow>
                  ) : (
                    prods.map((p) => <ProductTableRow key={p._id} p={p} />)
                  )}
                </TableBody>
              </Table>
            </div>
          ))}
      </div>
    );
  }

  const isLoading =
    products === undefined || categories === undefined || tags === undefined;

  // ── Render ─────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Products</h1>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex items-center border rounded-md overflow-hidden">
            <button
              onClick={() => toggleView("grid")}
              className={`p-2 transition-colors ${viewMode === "grid" ? "bg-foreground text-background" : "hover:bg-muted"}`}
              title="Grid view"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => toggleView("table")}
              className={`p-2 transition-colors ${viewMode === "table" ? "bg-foreground text-background" : "hover:bg-muted"}`}
              title="Table view"
            >
              <List className="h-4 w-4" />
            </button>
          </div>
          <Button asChild>
            <Link href="/admin/products/new">
              <Plus className="h-4 w-4 mr-1" />
              New Product
            </Link>
          </Button>
        </div>
      </div>

      {/* Batch action toolbar */}
      {selectedIds.size > 0 && viewMode === "grid" && (
        <div className="flex items-center gap-2 flex-wrap p-3 rounded-lg border bg-background/95 backdrop-blur shadow-md sticky top-4 z-50 text-sm">
          <span className="font-medium">{selectedIds.size} selected</span>
          <div className="flex-1" />
          <Select onValueChange={(groupId) => handleBatchAddToGroup(groupId)}>
            <SelectTrigger className="h-8 w-44 text-xs">
              <SelectValue placeholder="Add to discount group…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                value="none"
                className="text-xs text-destructive font-medium focus:text-destructive"
              >
                No discount group
              </SelectItem>
              {(discountGroups ?? []).map((g) => (
                <SelectItem key={g._id} value={g._id} className="text-xs">
                  {g.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select onValueChange={(catId) => handleBatchMoveCategory(catId)}>
            <SelectTrigger className="h-8 w-44 text-xs">
              <SelectValue placeholder="Move to category…" />
            </SelectTrigger>
            <SelectContent>
              {(categories ?? []).map((c) => (
                <SelectItem key={c._id} value={c._id} className="text-xs">
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select onValueChange={(tagId) => handleBatchAddTag(tagId)}>
            <SelectTrigger className="h-8 w-36 text-xs">
              <SelectValue placeholder="Add tag…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                value="none"
                className="text-xs text-destructive font-medium focus:text-destructive"
              >
                No tag
              </SelectItem>
              {(tags ?? []).map((t) => (
                <SelectItem key={t._id} value={t._id} className="text-xs">
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            variant="destructive"
            className="h-8 text-xs"
            disabled={batchDeleting}
            onClick={handleBatchDelete}
          >
            {batchDeleting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
            ) : (
              <Trash2 className="h-3.5 w-3.5 mr-1" />
            )}
            Delete
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 text-xs"
            onClick={clearSelection}
          >
            <X className="h-3.5 w-3.5 mr-1" />
            Clear
          </Button>
        </div>
      )}

      {/* Tabs (URL-based) */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as TabId)}>
        <TabsList className="flex w-full overflow-x-auto">
          <TabsTrigger value="all" className="flex-1">
            All
          </TabsTrigger>
          <TabsTrigger value="categories" className="flex-1">
            <FolderOpen className="h-3.5 w-3.5 mr-1.5" />
            Categories
          </TabsTrigger>
          <TabsTrigger value="tags" className="flex-1">
            <Tags className="h-3.5 w-3.5 mr-1.5" />
            Tags
          </TabsTrigger>
          <TabsTrigger value="discounts" className="flex-1">
            <Percent className="h-3.5 w-3.5 mr-1.5" />
            Discounts
          </TabsTrigger>
          <TabsTrigger value="recommendations" className="flex-1">
            <Star className="h-3.5 w-3.5 mr-1.5" />
            Recommendations
          </TabsTrigger>
        </TabsList>

        {/* ── ALL TAB ── */}
        {tab === "all" && (
          <div className="mt-6 space-y-8">
            {isLoading ? (
              viewMode === "grid" ? (
                <GridSkeleton />
              ) : (
                <TableSkeleton />
              )
            ) : (
              <>
                {drafts.length > 0 && (
                  <ProductGroupSection
                    label="Drafts"
                    prods={drafts}
                    sectionKey="drafts"
                    addHref="/admin/products/new?from=all"
                    onReorder={(items) =>
                      reorderGlobal({ items }).catch(() =>
                        toast.error("Failed to reorder"),
                      )
                    }
                    onPublish={(id) => handleStatusChange(id, "active")}
                  />
                )}
                {scheduled.length > 0 && (
                  <ProductGroupSection
                    label="Scheduled"
                    prods={scheduled}
                    sectionKey="scheduled"
                    addHref="/admin/products/new?from=all"
                    onReorder={(items) =>
                      reorderGlobal({ items }).catch(() =>
                        toast.error("Failed to reorder"),
                      )
                    }
                  />
                )}
                {active.length > 0 || drafts.length === 0 ? (
                  <ProductGroupSection
                    label="Active"
                    prods={active}
                    sectionKey="active"
                    addHref="/admin/products/new?from=all"
                    onReorder={(items) =>
                      reorderGlobal({ items }).catch(() =>
                        toast.error("Failed to reorder"),
                      )
                    }
                  />
                ) : null}
                {drafts.length === 0 &&
                  scheduled.length === 0 &&
                  active.length === 0 && (
                    <div className="text-center py-16 text-muted-foreground">
                      <p className="mb-4">No products yet.</p>
                      <Button asChild>
                        <Link href="/admin/products/new?from=all">
                          <Plus className="h-4 w-4 mr-1" />
                          Add your first product
                        </Link>
                      </Button>
                    </div>
                  )}

                {/* Archived toggle */}
                <div className="pt-2 border-t">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const params = new URLSearchParams(
                        searchParams.toString(),
                      );
                      if (showArchived) params.delete("archived");
                      else params.set("archived", "true");
                      router.replace(`/admin/products?${params.toString()}`);
                    }}
                    className="text-muted-foreground"
                  >
                    {showArchived ? (
                      <ChevronDown className="h-4 w-4 mr-1" />
                    ) : (
                      <ChevronRight className="h-4 w-4 mr-1" />
                    )}
                    Archived ({archived.length})
                  </Button>
                  {showArchived && archived.length > 0 && (
                    <div className="mt-3">
                      <ProductGroupSection
                        label="Archived"
                        prods={archived}
                        sectionKey="archived"
                        addHref="/admin/products/new?from=all"
                        onReorder={(items) =>
                          reorderGlobal({ items }).catch(() =>
                            toast.error("Failed to reorder"),
                          )
                        }
                      />
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* ── CATEGORIES TAB ── */}
        {tab === "categories" && (
          <div className="mt-6 space-y-6">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Products organised by category. Drag to reorder within each
                category.
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowNewCategory(true)}
              >
                <Plus className="h-4 w-4 mr-1" />
                New Category
              </Button>
            </div>

            {isLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-24 w-full rounded-lg" />
                ))}
              </div>
            ) : (categories ?? []).length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p className="mb-3">No categories yet.</p>
                <Button size="sm" onClick={() => setShowNewCategory(true)}>
                  <Plus className="h-4 w-4 mr-1" />
                  Create Category
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {(categories ?? [])
                  .sort((a, b) => a.sortOrder - b.sortOrder)
                  .map((cat) => {
                    const catProducts = (products ?? [])
                      .filter(
                        (p) =>
                          p.categoryId === cat._id &&
                          effectiveStatus(p as any) !== "archived",
                      )
                      .sort(
                        (a, b) => a.categorySortOrder - b.categorySortOrder,
                      );
                    const isCollapsed = collapsed.has(`cat-${cat._id}`);

                    return (
                      <div
                        key={cat._id}
                        className="rounded-lg border overflow-hidden"
                      >
                        <div className="flex items-center justify-between px-4 py-3 bg-muted/30">
                          <button
                            onClick={() => toggleSection(`cat-${cat._id}`)}
                            className="flex items-center gap-2 flex-1 text-left"
                          >
                            {isCollapsed ? (
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            )}
                            <span className="font-medium text-sm">
                              {cat.name}
                            </span>
                            {!cat.isActive && (
                              <Badge
                                variant="secondary"
                                className="text-[10px] px-1.5 py-0"
                              >
                                Inactive
                              </Badge>
                            )}
                            <span className="text-xs text-muted-foreground ml-1">
                              ({catProducts.length})
                            </span>
                          </button>
                          <RowActionsMenu
                            actions={[
                              {
                                label: "Edit",
                                icon: Pencil,
                                onClick: () =>
                                  setEditCategory({
                                    id: cat._id,
                                    name: cat.name,
                                  }),
                              },
                              {
                                label: cat.isActive ? "Deactivate" : "Activate",
                                icon: cat.isActive ? ToggleLeft : ToggleRight,
                                separator: true,
                                onClick: () =>
                                  toggleCategoryActive({
                                    id: cat._id,
                                    isActive: !cat.isActive,
                                  })
                                    .then(() =>
                                      toast.success("Category updated"),
                                    )
                                    .catch((e) => toast.error(e.message)),
                              },
                              {
                                label: "Delete",
                                icon: Trash2,
                                variant: "destructive",
                                separator: true,
                                onClick: () => {
                                  if (
                                    !confirm(
                                      `Delete category "${cat.name}"? Products in this category will be uncategorized.`,
                                    )
                                  )
                                    return;
                                  removeCategory({ id: cat._id });
                                },
                              },
                            ]}
                          />
                        </div>
                        {!isCollapsed && (
                          <div className="p-4">
                            {viewMode === "grid" ? (
                              <SortableProductGrid
                                items={catProducts.map((p) => ({
                                  id: p._id,
                                  name: p.name,
                                  basePrice: p.basePrice,
                                  effectivePrice: p.effectivePrice,
                                  discountAmount: p.discountAmount,
                                  status: p.status as ProductStatus,
                                  imageUrl: p.imageUrl,
                                  scheduledPublishTime: (p as any)
                                    .scheduledPublishTime,
                                  categoryName: cat.name,
                                  totalStock: (p.variants ?? []).reduce(
                                    (sum: number, v: any) =>
                                      sum + (v.stock ?? 0),
                                    0,
                                  ),
                                  variantCount: (p.variants ?? []).length,
                                  tags: (p.tagIds ?? [])
                                    .map(
                                      (id: string) =>
                                        tagMap.get(id as Id<"tags">)?.name,
                                    )
                                    .filter(Boolean) as string[],
                                }))}
                                selectedIds={selectedIds}
                                onToggleSelect={toggleSelect}
                                onReorder={(items) =>
                                  reorderCategory({ items }).catch(() =>
                                    toast.error("Failed to reorder"),
                                  )
                                }
                                prefix={
                                  <AddProductCard
                                    href={`/admin/products/new?categoryId=${cat._id}&from=categories`}
                                  />
                                }
                              />
                            ) : (
                              <div className="rounded-md border">
                                <Table>
                                  <TableBody>
                                    {catProducts.length === 0 ? (
                                      <TableRow>
                                        <TableCell className="text-center py-4 text-muted-foreground text-sm">
                                          No products in this category
                                        </TableCell>
                                      </TableRow>
                                    ) : (
                                      catProducts.map((p) => (
                                        <ProductTableRow key={p._id} p={p} />
                                      ))
                                    )}
                                  </TableBody>
                                </Table>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        )}

        {/* ── TAGS TAB ── */}
        {tab === "tags" && (
          <div className="mt-6 space-y-6">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Products grouped by tag.
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowNewTag(true)}
              >
                <Plus className="h-4 w-4 mr-1" />
                New Tag
              </Button>
            </div>

            {isLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-24 w-full rounded-lg" />
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {(() => {
                  const untaggedProducts = (products ?? []).filter(
                    (p) =>
                      (!(p.tagIds as string[]) ||
                        (p.tagIds as string[]).length === 0) &&
                      effectiveStatus(p as any) !== "archived",
                  );
                  if (untaggedProducts.length === 0) return null;
                  return (
                    <div className="mb-6">
                      <ProductGroupSection
                        label="Untagged Products"
                        prods={untaggedProducts}
                        sectionKey="untagged"
                        addHref="/admin/products/new?from=tags"
                      />
                    </div>
                  );
                })()}
                {(tags ?? []).length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground border rounded-lg">
                    <p className="mb-3">No tags yet.</p>
                    <Button size="sm" onClick={() => setShowNewTag(true)}>
                      <Plus className="h-4 w-4 mr-1" />
                      Create Tag
                    </Button>
                  </div>
                ) : (
                  (tags ?? []).map((tag) => {
                    const tagProducts = (products ?? [])
                      .filter(
                        (p) =>
                          (p.tagIds as string[]).includes(tag._id) &&
                          effectiveStatus(p as any) !== "archived",
                      )
                      .sort((a, b) => a.globalSortOrder - b.globalSortOrder);
                    const isCollapsed = collapsed.has(`tag-${tag._id}`);

                    return (
                      <div
                        key={tag._id}
                        className="rounded-lg border overflow-hidden"
                      >
                        <div className="flex items-center justify-between px-4 py-3 bg-muted/30">
                          <button
                            onClick={() => toggleSection(`tag-${tag._id}`)}
                            className="flex items-center gap-2 flex-1 text-left"
                          >
                            {isCollapsed ? (
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            )}
                            <span className="font-medium text-sm">
                              {tag.name}
                            </span>
                            {!tag.isActive && (
                              <Badge
                                variant="secondary"
                                className="text-[10px] px-1.5 py-0"
                              >
                                Inactive
                              </Badge>
                            )}
                            <span className="text-xs text-muted-foreground ml-1">
                              ({tagProducts.length})
                            </span>
                          </button>
                          <RowActionsMenu
                            actions={[
                              {
                                label: "Edit",
                                icon: Pencil,
                                onClick: () =>
                                  setEditTag({ id: tag._id, name: tag.name }),
                              },
                              {
                                label: tag.isActive ? "Deactivate" : "Activate",
                                icon: tag.isActive ? ToggleLeft : ToggleRight,
                                separator: true,
                                onClick: () =>
                                  toggleTagActive({
                                    id: tag._id,
                                    isActive: !tag.isActive,
                                  })
                                    .then(() => toast.success("Tag updated"))
                                    .catch((e) => toast.error(e.message)),
                              },
                              {
                                label: "Delete",
                                icon: Trash2,
                                variant: "destructive",
                                separator: true,
                                onClick: () => {
                                  if (
                                    !confirm(
                                      `Delete tag "${tag.name}"? Products will not be deleted.`,
                                    )
                                  )
                                    return;
                                  removeTag({ id: tag._id })
                                    .then(() => toast.success("Tag deleted"))
                                    .catch((e) => toast.error(e.message));
                                },
                              },
                            ]}
                          />
                        </div>
                        {!isCollapsed && (
                          <div className="p-4">
                            {viewMode === "grid" ? (
                              (() => {
                                // Build productId → productTagId map for this tag
                                const productTagIdMap = new Map<
                                  string,
                                  Id<"productTags">
                                >();
                                for (const p of tagProducts) {
                                  const entry = (
                                    p.productTagEntries ?? []
                                  ).find((e: any) => e.tagId === tag._id);
                                  if (entry)
                                    productTagIdMap.set(
                                      p._id,
                                      entry.productTagId,
                                    );
                                }
                                return (
                                  <SortableProductGrid
                                    items={tagProducts.map((p) => ({
                                      id: p._id,
                                      name: p.name,
                                      basePrice: p.basePrice,
                                      effectivePrice: p.effectivePrice,
                                      discountAmount: p.discountAmount,
                                      status: p.status as ProductStatus,
                                      imageUrl: p.imageUrl,
                                      scheduledPublishTime: (p as any)
                                        .scheduledPublishTime,
                                      categoryName: categoryMap.get(
                                        p.categoryId as Id<"categories">,
                                      )?.name,
                                      totalStock: (p.variants ?? []).reduce(
                                        (sum: number, v: any) =>
                                          sum + (v.stock ?? 0),
                                        0,
                                      ),
                                      variantCount: (p.variants ?? []).length,
                                      tags: (p.tagIds ?? [])
                                        .map(
                                          (id: string) =>
                                            tagMap.get(id as Id<"tags">)?.name,
                                        )
                                        .filter(Boolean) as string[],
                                    }))}
                                    selectedIds={selectedIds}
                                    onToggleSelect={toggleSelect}
                                    onReorder={(items) => {
                                      const reorderItems = items
                                        .map((item) => {
                                          const productTagId =
                                            productTagIdMap.get(item.id);
                                          if (!productTagId) return null;
                                          return {
                                            productTagId,
                                            sortOrder: item.sortOrder,
                                          };
                                        })
                                        .filter(Boolean) as {
                                        productTagId: Id<"productTags">;
                                        sortOrder: number;
                                      }[];
                                      reorderTag({ items: reorderItems }).catch(
                                        () => toast.error("Failed to reorder"),
                                      );
                                    }}
                                    prefix={
                                      <AddProductCard
                                        href={`/admin/products/new?tagId=${tag._id}&from=tags`}
                                      />
                                    }
                                  />
                                );
                              })()
                            ) : (
                              <div className="rounded-md border">
                                <Table>
                                  <TableBody>
                                    {tagProducts.length === 0 ? (
                                      <TableRow>
                                        <TableCell className="text-center py-4 text-muted-foreground text-sm">
                                          No products with this tag
                                        </TableCell>
                                      </TableRow>
                                    ) : (
                                      tagProducts.map((p) => (
                                        <ProductTableRow key={p._id} p={p} />
                                      ))
                                    )}
                                  </TableBody>
                                </Table>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        )}

        {/* ── DISCOUNTS TAB ── */}
        {tab === "discounts" && (
          <div className="mt-6 space-y-8">
            {/* Discount Groups */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold">Discount Groups</h2>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowNewGroup(true)}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  New Group
                </Button>
              </div>

              {discountGroups === undefined ? (
                <Skeleton className="h-32 w-full rounded-lg" />
              ) : discountGroups.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground border rounded-lg">
                  <p className="mb-3 text-sm">No discount groups yet.</p>
                  <Button size="sm" onClick={() => setShowNewGroup(true)}>
                    <Plus className="h-4 w-4 mr-1" />
                    Create Group
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {discountGroups.map((group, groupIdx) => {
                    // Get memberships for this group, sorted by sortOrder asc
                    const groupMembersSorted = (groupMemberships ?? [])
                      .filter((m) => m.groupId === group._id)
                      .sort((a, b) => a.sortOrder - b.sortOrder);
                    const groupProductMembers = groupMembersSorted
                      .map((membership) => {
                        const product = (products ?? []).find(
                          (p) => p._id === membership.productId,
                        );
                        if (!product) return null;
                        return {
                          membershipId: membership._id,
                          sortOrder: membership.sortOrder,
                          product,
                        };
                      })
                      .filter(Boolean) as Array<{
                      membershipId: Id<"discountGroupProducts">;
                      sortOrder: number;
                      product: NonNullable<typeof products>[number];
                    }>;
                    const groupProducts = groupProductMembers.map(
                      (member) => member.product,
                    );
                    const isActive =
                      group.isActive &&
                      group.startTime <= now &&
                      (!group.endTime || group.endTime > now);
                    const discountLabel =
                      group.discountType === "percentage"
                        ? `${group.discountValue}% off`
                        : `৳${group.discountValue} off`;

                    function moveGroup(dir: "up" | "down") {
                      const otherIdx =
                        dir === "up" ? groupIdx - 1 : groupIdx + 1;
                      if (otherIdx < 0 || otherIdx >= discountGroups!.length)
                        return;
                      const other = discountGroups![otherIdx];
                      reorderGroups({
                        items: [
                          { id: group._id, sortOrder: other.sortOrder },
                          { id: other._id, sortOrder: group.sortOrder },
                        ],
                      }).catch((e: Error) => toast.error(e.message));
                    }

                    return (
                      <div
                        key={group._id}
                        className="rounded-lg border overflow-hidden"
                      >
                        <div className="flex items-center justify-between px-4 py-3 bg-muted/30">
                          <div className="flex items-center gap-2">
                            {/* Group reorder buttons */}
                            <div className="flex flex-col gap-0.5">
                              <button
                                onClick={() => moveGroup("up")}
                                disabled={groupIdx === 0}
                                className="p-0.5 rounded hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                title="Move group up"
                              >
                                <ChevronUp className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => moveGroup("down")}
                                disabled={
                                  groupIdx === discountGroups!.length - 1
                                }
                                className="p-0.5 rounded hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                title="Move group down"
                              >
                                <ChevronDown className="h-3.5 w-3.5" />
                              </button>
                            </div>
                            <span className="font-medium text-sm">
                              {group.name}
                            </span>
                            <Badge variant="secondary" className="text-xs">
                              {discountLabel}
                            </Badge>
                            {isActive ? (
                              <Badge variant="default" className="text-xs">
                                Active
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs">
                                Inactive
                              </Badge>
                            )}
                            <span className="text-xs text-muted-foreground">
                              {groupProducts.length} products
                            </span>
                          </div>
                          <RowActionsMenu
                            actions={[
                              {
                                label: "Edit Group",
                                icon: Pencil,
                                onClick: () => setEditGroup(group),
                              },
                              {
                                label: group.isActive
                                  ? "Deactivate"
                                  : "Activate",
                                icon: group.isActive ? ToggleLeft : ToggleRight,
                                separator: true,
                                onClick: () =>
                                  toggleGroupActive({
                                    id: group._id,
                                    isActive: !group.isActive,
                                  })
                                    .then(() => toast.success("Updated"))
                                    .catch((e) => toast.error(e.message)),
                              },
                              {
                                label: "Delete Group",
                                icon: Trash2,
                                variant: "destructive",
                                separator: true,
                                onClick: () => {
                                  if (
                                    !confirm(
                                      `Delete discount group "${group.name}"?`,
                                    )
                                  )
                                    return;
                                  removeGroup({ id: group._id })
                                    .then(() => toast.success("Group deleted"))
                                    .catch((e) => toast.error(e.message));
                                },
                              },
                            ]}
                          />
                        </div>
                        <div className="p-4 space-y-3">
                          {/* Add existing product to group */}
                          <div className="flex gap-2 items-center">
                            <div className="flex-1 max-w-xs">
                              <ProductPicker
                                onSelect={(p) => {
                                  addProductsToGroup({
                                    groupId: group._id,
                                    productIds: [p.id],
                                  })
                                    .then(() =>
                                      toast.success(
                                        `Added "${p.name}" to group`,
                                      ),
                                    )
                                    .catch((e) => toast.error(e.message));
                                }}
                                placeholder="Add product to group…"
                              />
                            </div>
                            <Link
                              href={`/admin/products/new?discountGroupId=${group._id}`}
                            >
                              <Button size="sm" variant="outline">
                                <Plus className="h-4 w-4 mr-1" />
                                New Product
                              </Button>
                            </Link>
                          </div>

                          {/* Products grid/table */}
                          {viewMode === "grid" ? (
                            groupProducts.length === 0 ? (
                              <p className="text-sm text-muted-foreground py-4">
                                No products in this group yet.
                              </p>
                            ) : (
                              <SortableProductGrid
                                items={groupProducts.map((p) => ({
                                  id: p._id,
                                  name: p.name,
                                  basePrice: p.basePrice,
                                  effectivePrice: p.effectivePrice,
                                  discountAmount: p.discountAmount,
                                  discountSource: p.discountSource,
                                  discountGroupName: p.discountGroupName,
                                  saleDisplayMode: p.saleDisplayMode,
                                  saleStartMode: p.saleStartMode,
                                  saleStartTime: p.saleStartTime,
                                  saleEndMode: p.saleEndMode,
                                  saleEndTime: p.saleEndTime,
                                  status: p.status as ProductStatus,
                                  imageUrl: p.imageUrl,
                                  categoryName: categoryMap.get(
                                    p.categoryId as Id<"categories">,
                                  )?.name,
                                  totalStock: (p.variants ?? []).reduce(
                                    (sum: number, v: any) =>
                                      sum + (v.stock ?? 0),
                                    0,
                                  ),
                                  variantCount: (p.variants ?? []).length,
                                  tags: (p.tagIds ?? [])
                                    .map(
                                      (id: string) =>
                                        tagMap.get(id as Id<"tags">)?.name,
                                    )
                                    .filter(Boolean) as string[],
                                }))}
                                selectedIds={selectedIds}
                                onToggleSelect={toggleSelect}
                                onReorder={(items) => {
                                  const membershipIdByProductId = new Map(
                                    groupProductMembers.map((member) => [
                                      member.product._id,
                                      member.membershipId,
                                    ]),
                                  );
                                  const reorderItems = items
                                    .map((item) => {
                                      const membershipId =
                                        membershipIdByProductId.get(item.id);
                                      if (!membershipId) return null;
                                      return {
                                        membershipId,
                                        sortOrder: item.sortOrder,
                                      };
                                    })
                                    .filter(Boolean) as {
                                    membershipId: Id<"discountGroupProducts">;
                                    sortOrder: number;
                                  }[];
                                  reorderProductsInGroup({
                                    items: reorderItems,
                                  }).catch((e: Error) =>
                                    toast.error(e.message),
                                  );
                                }}
                                renderOverlay={(item) => (
                                  <button
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      removeProductFromGroup({
                                        groupId: group._id,
                                        productId: item.id,
                                      })
                                        .then(() =>
                                          toast.success("Removed from group"),
                                        )
                                        .catch((e) => toast.error(e.message));
                                    }}
                                    className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                )}
                              />
                            )
                          ) : groupProductMembers.length === 0 ? (
                            <div className="rounded-md border">
                              <Table>
                                <TableBody>
                                  <TableRow>
                                    <TableCell className="text-center py-4 text-muted-foreground text-sm">
                                      No products in this group
                                    </TableCell>
                                  </TableRow>
                                </TableBody>
                              </Table>
                            </div>
                          ) : (
                            <div className="rounded-md border">
                              <SortableProductTable
                                items={groupProductMembers.map((member) => ({
                                  _id: member.membershipId,
                                  sortOrder: member.sortOrder,
                                  product: member.product,
                                }))}
                                header={
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead className="w-12">
                                        Drag
                                      </TableHead>
                                      <TableHead>Name</TableHead>
                                      <TableHead>Regular Price</TableHead>
                                      <TableHead>Sale Price</TableHead>
                                      <TableHead className="w-16" />
                                    </TableRow>
                                  </TableHeader>
                                }
                                onReorder={(items) => {
                                  reorderProductsInGroup({
                                    items: items.map((item) => ({
                                      membershipId:
                                        item.id as Id<"discountGroupProducts">,
                                      sortOrder: item.sortOrder,
                                    })),
                                  }).catch((e: Error) =>
                                    toast.error(e.message),
                                  );
                                }}
                                renderRow={(member, dragHandle) => (
                                  <>
                                    <TableCell className="w-12">
                                      {dragHandle}
                                    </TableCell>
                                    <TableCell className="font-medium">
                                      {member.product.name}
                                    </TableCell>
                                    <TableCell>
                                      ৳
                                      {member.product.basePrice.toLocaleString()}
                                    </TableCell>
                                    <TableCell className="text-destructive">
                                      ৳
                                      {member.product.effectivePrice.toLocaleString()}
                                    </TableCell>
                                    <TableCell className="text-right">
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="text-destructive h-7"
                                        onClick={() =>
                                          removeProductFromGroup({
                                            groupId: group._id,
                                            productId: member.product._id,
                                          })
                                            .then(() =>
                                              toast.success("Removed"),
                                            )
                                            .catch((e) =>
                                              toast.error(e.message),
                                            )
                                        }
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </Button>
                                    </TableCell>
                                  </>
                                )}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Individual Discounts */}
            {products !== undefined &&
              groupMemberships !== undefined &&
              (() => {
                const allGroupProductIds = new Set(
                  (groupMemberships ?? []).map((m) => m.productId),
                );
                const rawIndividual = (products ?? []).filter(
                  (p) =>
                    !allGroupProductIds.has(p._id) &&
                    p.saleEnabled &&
                    p.salePrice !== undefined &&
                    p.effectivePrice < p.basePrice &&
                    effectiveStatus(p as any) !== "archived",
                );
                // Sort by saleDiscountSortOrder asc (undefined = last), fallback _creationTime
                const individualDiscountProducts = [...rawIndividual].sort(
                  (a, b) => {
                    const aO =
                      (a as any).saleDiscountSortOrder ??
                      Number.MAX_SAFE_INTEGER;
                    const bO =
                      (b as any).saleDiscountSortOrder ??
                      Number.MAX_SAFE_INTEGER;
                    if (aO !== bO) return aO - bO;
                    return a._creationTime - b._creationTime;
                  },
                );

                const noDiscountProducts = (products ?? []).filter(
                  (p) =>
                    !allGroupProductIds.has(p._id) &&
                    !(p.saleEnabled && p.salePrice !== undefined) &&
                    effectiveStatus(p as any) !== "archived",
                );

                return (
                  <>
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <h2 className="text-base font-semibold">
                          Individual Discounts
                        </h2>
                        <span className="text-xs text-muted-foreground">
                          (Drag to set display order on the sale page)
                        </span>
                      </div>
                      {individualDiscountProducts.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          No products with individual discounts.
                        </p>
                      ) : viewMode === "grid" ? (
                        <SortableProductGrid
                          items={individualDiscountProducts.map((p) => ({
                            id: p._id,
                            name: p.name,
                            basePrice: p.basePrice,
                            effectivePrice: p.effectivePrice,
                            discountAmount: p.discountAmount,
                            discountSource: p.discountSource,
                            discountGroupName: p.discountGroupName,
                            saleDisplayMode: p.saleDisplayMode,
                            saleStartMode: p.saleStartMode,
                            saleStartTime: p.saleStartTime,
                            saleEndMode: p.saleEndMode,
                            saleEndTime: p.saleEndTime,
                            status: p.status as ProductStatus,
                            imageUrl: p.imageUrl,
                            categoryName: categoryMap.get(
                              p.categoryId as Id<"categories">,
                            )?.name,
                            totalStock: (p.variants ?? []).reduce(
                              (sum: number, v: any) => sum + (v.stock ?? 0),
                              0,
                            ),
                            variantCount: (p.variants ?? []).length,
                            tags: (p.tagIds ?? [])
                              .map(
                                (id: string) =>
                                  tagMap.get(id as Id<"tags">)?.name,
                              )
                              .filter(Boolean) as string[],
                          }))}
                          selectedIds={selectedIds}
                          onToggleSelect={toggleSelect}
                          onReorder={(items) => {
                            reorderSaleDiscount({
                              items: items.map((item) => ({
                                id: item.id,
                                saleDiscountSortOrder: item.sortOrder,
                              })),
                            }).catch((e: Error) => toast.error(e.message));
                          }}
                        />
                      ) : (
                        <div className="rounded-md border">
                          <SortableProductTable
                            items={individualDiscountProducts.map(
                              (product, index) => ({
                                _id: product._id,
                                sortOrder:
                                  (product as any).saleDiscountSortOrder ??
                                  index,
                                product,
                              }),
                            )}
                            header={
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="w-12">Drag</TableHead>
                                  <TableHead>Name</TableHead>
                                  <TableHead>Regular Price</TableHead>
                                  <TableHead>Sale Price</TableHead>
                                  <TableHead>Discount</TableHead>
                                  <TableHead className="w-16" />
                                </TableRow>
                              </TableHeader>
                            }
                            onReorder={(items) => {
                              reorderSaleDiscount({
                                items: items.map((item) => ({
                                  id: item.id as Id<"products">,
                                  saleDiscountSortOrder: item.sortOrder,
                                })),
                              }).catch((e: Error) => toast.error(e.message));
                            }}
                            renderRow={(entry, dragHandle) => (
                              <>
                                <TableCell className="w-12">
                                  {dragHandle}
                                </TableCell>
                                <TableCell className="font-medium">
                                  {entry.product.name}
                                </TableCell>
                                <TableCell className="line-through text-muted-foreground">
                                  ৳{entry.product.basePrice.toLocaleString()}
                                </TableCell>
                                <TableCell className="text-destructive font-medium">
                                  ৳
                                  {entry.product.effectivePrice.toLocaleString()}
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground">
                                  ৳
                                  {entry.product.discountAmount.toLocaleString()}{" "}
                                  off
                                </TableCell>
                                <TableCell className="text-right">
                                  <Button size="sm" variant="ghost" asChild>
                                    <Link
                                      href={`/admin/products/${entry.product._id}`}
                                    >
                                      <Pencil className="h-3.5 w-3.5" />
                                    </Link>
                                  </Button>
                                </TableCell>
                              </>
                            )}
                          />
                        </div>
                      )}
                    </div>

                    <div className="space-y-3">
                      <h2 className="text-base font-semibold text-muted-foreground">
                        Regular Price — No Discount
                      </h2>
                      {noDiscountProducts.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          All products have some form of discount.
                        </p>
                      ) : viewMode === "grid" ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                          {noDiscountProducts.map((p) => (
                            <ProductGridCard
                              key={p._id}
                              id={p._id}
                              name={p.name}
                              basePrice={p.basePrice}
                              effectivePrice={p.effectivePrice}
                              discountAmount={p.discountAmount}
                              discountSource={p.discountSource}
                              discountGroupName={p.discountGroupName}
                              saleDisplayMode={p.saleDisplayMode}
                              saleStartMode={p.saleStartMode}
                              saleStartTime={p.saleStartTime}
                              saleEndMode={p.saleEndMode}
                              saleEndTime={p.saleEndTime}
                              status={p.status as ProductStatus}
                              imageUrl={p.imageUrl}
                              isSelected={selectedIds.has(p._id)}
                              onToggleSelect={() => toggleSelect(p._id)}
                            />
                          ))}
                        </div>
                      ) : (
                        <div className="rounded-md border">
                          <Table>
                            <TableBody>
                              {noDiscountProducts.map((p) => (
                                <ProductTableRow key={p._id} p={p} />
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </div>
                  </>
                );
              })()}
          </div>
        )}

        {/* ── RECOMMENDATIONS TAB ── */}
        {tab === "recommendations" && (
          <div className="mt-6 space-y-6">
            <div className="space-y-1">
              <h2 className="text-base font-semibold">You May Also Like</h2>
              <p className="text-xs text-muted-foreground">
                Shown on all product detail pages.
              </p>
            </div>
            <RecSection type="also_like" />

            <div className="space-y-1 pt-4 border-t">
              <h2 className="text-base font-semibold">People Also Bought</h2>
              <p className="text-xs text-muted-foreground">
                Shown at checkout, grouped by size. Add specific variants
                customers should see.
              </p>
            </div>
            <AlsoBoughtAdminSection />
          </div>
        )}
      </Tabs>

      {/* ── Dialogs ── */}
      <QuickCategoryDialog
        open={showNewCategory || !!editCategory}
        onOpenChange={(o) => {
          if (!o) {
            setShowNewCategory(false);
            setEditCategory(null);
          } else setShowNewCategory(true);
        }}
        editId={editCategory?.id}
        editName={editCategory?.name}
      />
      <QuickTagDialog
        open={showNewTag || !!editTag}
        onOpenChange={(o) => {
          if (!o) {
            setShowNewTag(false);
            setEditTag(null);
          } else setShowNewTag(true);
        }}
        editId={editTag?.id}
        editName={editTag?.name}
      />
      <DiscountGroupDialog
        open={showNewGroup || !!editGroup}
        onOpenChange={(o) => {
          if (!o) {
            setShowNewGroup(false);
            setEditGroup(null);
          } else setShowNewGroup(true);
        }}
        editId={editGroup?._id}
        editData={editGroup}
      />

      {/* Delete product confirm */}
      <AlertDialog
        open={!!deleteProductId}
        onOpenChange={(o) => {
          if (!o) setDeleteProductId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Product?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the product and all its variants.
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteProductId && handleDelete(deleteProductId)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Page export ──────────────────────────────────────────────────────────────

export default function AdminProductsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-24">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground" />
        </div>
      }
    >
      <AdminProductsContent />
    </Suspense>
  );
}
