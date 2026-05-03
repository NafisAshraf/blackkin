"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Loader2, Pencil, Trash2, Plus, Check } from "lucide-react";
import { SortableList } from "@/components/admin/SortableList";
import { RowActionsMenu } from "@/components/admin/RowActionsMenu";

type PlatformSize = {
  _id: Id<"platformSizes">;
  _creationTime: number;
  name: string;
  measurements: string;
  sortOrder: number;
};

type PlatformColor = {
  _id: Id<"platformColors">;
  _creationTime: number;
  name: string;
  hexCode: string; // required
  sortOrder: number;
};

// ─── SizeDialog ───────────────────────────────────────────────

type SizeDialogState =
  | { mode: "closed" }
  | { mode: "create" }
  | { mode: "edit"; size: PlatformSize };

function SizeDialog({
  state,
  onClose,
}: {
  state: SizeDialogState;
  onClose: () => void;
}) {
  const isEdit = state.mode === "edit";
  const initial = isEdit ? state.size : null;
  const [name, setName] = useState(initial?.name ?? "");
  const [measurements, setMeasurements] = useState(initial?.measurements ?? "");
  const [loading, setLoading] = useState(false);
  const createMutation = useMutation(api.platformConfig.createSize);
  const updateMutation = useMutation(api.platformConfig.updateSize);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (isEdit) {
        await updateMutation({ id: state.size._id, name, measurements });
        toast.success("Size updated");
      } else {
        await createMutation({ name, measurements });
        toast.success("Size created");
      }
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{isEdit ? "Edit Size" : "New Size"}</DialogTitle>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1">
          <Label htmlFor="size-name">Name</Label>
          <Input
            id="size-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Small, Medium, XL"
            required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="size-measurements">Measurements</Label>
          <Textarea
            id="size-measurements"
            value={measurements}
            onChange={(e) => setMeasurements(e.target.value)}
            placeholder="e.g. Chest: 34-36in, Waist: 28-30in"
            rows={3}
          />
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? "Saving…" : isEdit ? "Update" : "Create"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

function SizesTab() {
  const sizes = useQuery(api.platformConfig.listSizes);
  const deleteMutation = useMutation(api.platformConfig.deleteSize);
  const reorderMutation = useMutation(api.platformConfig.reorderSizes);
  const [dialogState, setDialogState] = useState<SizeDialogState>({
    mode: "closed",
  });
  const [deleteTarget, setDeleteTarget] = useState<PlatformSize | null>(null);
  const [deletingId, setDeletingId] = useState<Id<"platformSizes"> | null>(
    null,
  );
  const [reordering, setReordering] = useState(false);

  async function handleDelete(size: PlatformSize) {
    setDeletingId(size._id);
    setDeleteTarget(null);
    try {
      await deleteMutation({ id: size._id });
      toast.success("Size deleted");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleReorder(reordered: { id: string; sortOrder: number }[]) {
    if (reordering) return;
    setReordering(true);
    try {
      await reorderMutation({
        items: reordered.map((r) => ({
          id: r.id as Id<"platformSizes">,
          sortOrder: r.sortOrder,
        })),
      });
    } catch {
      toast.error("Failed to reorder");
    } finally {
      setReordering(false);
    }
  }

  const isOpen = dialogState.mode !== "closed";

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setDialogState({ mode: "create" })}>
          New Size
        </Button>
      </div>
      <Dialog
        open={isOpen}
        onOpenChange={(open) => !open && setDialogState({ mode: "closed" })}
      >
        {isOpen && (
          <SizeDialog
            state={dialogState}
            onClose={() => setDialogState({ mode: "closed" })}
          />
        )}
      </Dialog>
      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete size &quot;{deleteTarget?.name}&quot;?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && handleDelete(deleteTarget)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {sizes === undefined ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : sizes.length === 0 ? (
        <p className="text-muted-foreground text-sm py-4">No sizes yet.</p>
      ) : (
        <div className="rounded-md border divide-y">
          <SortableList
            items={sizes}
            onReorder={handleReorder}
            renderItem={(size, dragHandle) => (
              <div className="flex items-center gap-3 px-4 py-3 bg-background">
                {dragHandle}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{size.name}</p>
                  {size.measurements && (
                    <p className="text-xs text-muted-foreground truncate">
                      {size.measurements}
                    </p>
                  )}
                </div>
                <RowActionsMenu
                  actions={[
                    {
                      label: "Edit",
                      icon: Pencil,
                      onClick: () => setDialogState({ mode: "edit", size }),
                    },
                    {
                      label: deletingId === size._id ? "Deleting…" : "Delete",
                      icon: Trash2,
                      variant: "destructive",
                      disabled: deletingId === size._id,
                      separator: true,
                      onClick: () => setDeleteTarget(size),
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

// ─── ColorDialog ──────────────────────────────────────────────

type ColorDialogState =
  | { mode: "closed" }
  | { mode: "create" }
  | { mode: "edit"; color: PlatformColor };

function ColorDialog({
  state,
  onClose,
}: {
  state: ColorDialogState;
  onClose: () => void;
}) {
  const isEdit = state.mode === "edit";
  const initial = isEdit ? state.color : null;
  const [name, setName] = useState(initial?.name ?? "");
  const [hexCode, setHexCode] = useState(initial?.hexCode ?? "");
  const [loading, setLoading] = useState(false);
  const createMutation = useMutation(api.platformConfig.createColor);
  const updateMutation = useMutation(api.platformConfig.updateColor);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!hexCode.trim()) {
      toast.error("Hex code is required");
      return;
    }
    setLoading(true);
    try {
      if (isEdit) {
        await updateMutation({
          id: state.color._id,
          name,
          hexCode,
        });
        toast.success("Color updated");
      } else {
        await createMutation({ name, hexCode });
        toast.success("Color created");
      }
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{isEdit ? "Edit Color" : "New Color"}</DialogTitle>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1">
          <Label htmlFor="color-name">Name</Label>
          <Input
            id="color-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Midnight Black"
            required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="color-hex">
            Hex Code <span className="text-destructive">*</span>
          </Label>
          <div className="flex gap-2 items-center">
            <Input
              id="color-hex"
              value={hexCode}
              onChange={(e) => setHexCode(e.target.value)}
              placeholder="#000000"
              required
            />
            {hexCode && (
              <div
                className="w-8 h-8 rounded border shrink-0"
                style={{ backgroundColor: hexCode }}
              />
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Required. Enter a valid hex color code.
          </p>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? "Saving…" : isEdit ? "Update" : "Create"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

function ColorsTab() {
  const colors = useQuery(api.platformConfig.listColors);
  const deleteMutation = useMutation(api.platformConfig.deleteColor);
  const reorderMutation = useMutation(api.platformConfig.reorderColors);
  const [dialogState, setDialogState] = useState<ColorDialogState>({
    mode: "closed",
  });
  const [deleteTarget, setDeleteTarget] = useState<PlatformColor | null>(null);
  const [deletingId, setDeletingId] = useState<Id<"platformColors"> | null>(
    null,
  );
  const [reordering, setReordering] = useState(false);

  async function handleDelete(color: PlatformColor) {
    setDeletingId(color._id);
    setDeleteTarget(null);
    try {
      await deleteMutation({ id: color._id });
      toast.success("Color deleted");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleReorder(reordered: { id: string; sortOrder: number }[]) {
    if (reordering) return;
    setReordering(true);
    try {
      await reorderMutation({
        items: reordered.map((r) => ({
          id: r.id as Id<"platformColors">,
          sortOrder: r.sortOrder,
        })),
      });
    } catch {
      toast.error("Failed to reorder");
    } finally {
      setReordering(false);
    }
  }

  const isOpen = dialogState.mode !== "closed";

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setDialogState({ mode: "create" })}>
          New Color
        </Button>
      </div>
      <Dialog
        open={isOpen}
        onOpenChange={(open) => !open && setDialogState({ mode: "closed" })}
      >
        {isOpen && (
          <ColorDialog
            state={dialogState}
            onClose={() => setDialogState({ mode: "closed" })}
          />
        )}
      </Dialog>
      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete color &quot;{deleteTarget?.name}&quot;?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && handleDelete(deleteTarget)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {colors === undefined ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : colors.length === 0 ? (
        <p className="text-muted-foreground text-sm py-4">No colors yet.</p>
      ) : (
        <div className="rounded-md border divide-y">
          <SortableList
            items={colors}
            onReorder={handleReorder}
            renderItem={(color, dragHandle) => (
              <div className="flex items-center gap-3 px-4 py-3 bg-background">
                {dragHandle}
                <div className="flex-1 flex items-center gap-2 min-w-0">
                  {color.hexCode ? (
                    <span
                      className="h-5 w-5 rounded-full border shrink-0"
                      style={{ backgroundColor: color.hexCode }}
                    />
                  ) : (
                    <span className="h-5 w-5 rounded-full border border-dashed shrink-0 bg-muted" />
                  )}
                  <div className="min-w-0">
                    <p className="font-medium text-sm">{color.name}</p>
                    {color.hexCode && (
                      <p className="text-xs text-muted-foreground">
                        {color.hexCode}
                      </p>
                    )}
                  </div>
                </div>
                <RowActionsMenu
                  actions={[
                    {
                      label: "Edit",
                      icon: Pencil,
                      onClick: () => setDialogState({ mode: "edit", color }),
                    },
                    {
                      label: deletingId === color._id ? "Deleting…" : "Delete",
                      icon: Trash2,
                      variant: "destructive",
                      disabled: deletingId === color._id,
                      separator: true,
                      onClick: () => setDeleteTarget(color),
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

// ─── NavbarTab ────────────────────────────────────────────────

function NavbarTab() {
  const allCategories = useQuery(api.categories.listAll) ?? [];
  const navbarCategories =
    useQuery(api.platformConfig.listNavbarCategories) ?? [];
  const setNavbarCategory = useMutation(api.platformConfig.setNavbarCategory);
  const reorderMutation = useMutation(
    api.platformConfig.reorderNavbarCategories,
  );
  const [toggling, setToggling] = useState<string | null>(null);
  const [reordering, setReordering] = useState(false);

  const enabledIds = new Set(navbarCategories.map((c) => c.categoryId));

  async function handleToggle(categoryId: Id<"categories">) {
    setToggling(categoryId);
    try {
      await setNavbarCategory({
        categoryId,
        enabled: !enabledIds.has(categoryId),
      });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setToggling(null);
    }
  }

  async function handleReorder(reordered: { id: string; sortOrder: number }[]) {
    if (reordering) return;
    setReordering(true);
    try {
      await reorderMutation({
        items: reordered.map((r) => ({
          id: r.id as Id<"navbarCategories">,
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
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Select which categories appear in the navbar. Drag to reorder visible
        categories.
      </p>

      {/* All categories — toggle to enable/disable */}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          All Categories
        </h3>
        <div className="rounded-md border divide-y">
          {allCategories.map((cat) => {
            const isEnabled = enabledIds.has(cat._id);
            return (
              <div
                key={cat._id}
                className="flex items-center gap-3 px-4 py-3 bg-background"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{cat.name}</p>
                  <p className="text-xs text-muted-foreground">{cat.slug}</p>
                </div>
                <button
                  onClick={() => handleToggle(cat._id)}
                  disabled={toggling === cat._id}
                  className={`h-8 w-8 rounded flex items-center justify-center transition-colors ${
                    isEnabled
                      ? "bg-foreground text-white hover:bg-foreground/80"
                      : "border border-border hover:bg-muted"
                  }`}
                  aria-label={
                    isEnabled ? "Remove from navbar" : "Add to navbar"
                  }
                >
                  {toggling === cat._id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : isEnabled ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <Plus className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            );
          })}
          {allCategories.length === 0 && (
            <p className="text-sm text-muted-foreground px-4 py-3">
              No categories yet.
            </p>
          )}
        </div>
      </div>

      {/* Enabled navbar categories — sortable */}
      {navbarCategories.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Navbar Order (drag to reorder)
          </h3>
          <div className="rounded-md border divide-y">
            <SortableList
              items={navbarCategories}
              onReorder={handleReorder}
              renderItem={(item, dragHandle) => (
                <div className="flex items-center gap-3 px-4 py-3 bg-background">
                  {dragHandle}
                  <p className="flex-1 text-sm font-medium">{item.name}</p>
                </div>
              )}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── SearchQueriesTab ──────────────────────────────────────────

type SearchQuery = {
  _id: Id<"predefinedSearchQueries">;
  query: string;
  sortOrder: number;
  isActive: boolean;
};

type SearchQueryDialogState =
  | { mode: "closed" }
  | { mode: "create" }
  | { mode: "edit"; item: SearchQuery };

function SearchQueryDialog({
  state,
  onClose,
}: {
  state: SearchQueryDialogState;
  onClose: () => void;
}) {
  const isEdit = state.mode === "edit";
  const initial = isEdit ? state.item : null;
  const [query, setQuery] = useState(initial?.query ?? "");
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [loading, setLoading] = useState(false);
  const createMutation = useMutation(
    api.platformConfig.createPredefinedSearchQuery,
  );
  const updateMutation = useMutation(
    api.platformConfig.updatePredefinedSearchQuery,
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (isEdit) {
        await updateMutation({ id: state.item._id, query, isActive });
        toast.success("Search query updated");
      } else {
        await createMutation({ query });
        toast.success("Search query created");
      }
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>
          {isEdit ? "Edit Search Query" : "New Search Query"}
        </DialogTitle>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1">
          <Label htmlFor="sq-query">Query</Label>
          <Input
            id="sq-query"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. summer collection"
            required
          />
        </div>
        <div className="flex items-center gap-2">
          <input
            id="sq-active"
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="h-4 w-4"
          />
          <Label htmlFor="sq-active">Active (visible to shoppers)</Label>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? "Saving…" : isEdit ? "Update" : "Create"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

function SearchQueriesTab() {
  const queries = useQuery(api.platformConfig.listAllPredefinedSearchQueries);
  const deleteMutation = useMutation(
    api.platformConfig.deletePredefinedSearchQuery,
  );
  const reorderMutation = useMutation(
    api.platformConfig.reorderPredefinedSearchQueries,
  );
  const [dialogState, setDialogState] = useState<SearchQueryDialogState>({
    mode: "closed",
  });
  const [deleteTarget, setDeleteTarget] = useState<SearchQuery | null>(null);
  const [deletingId, setDeletingId] =
    useState<Id<"predefinedSearchQueries"> | null>(null);
  const [reordering, setReordering] = useState(false);

  async function handleDelete(item: SearchQuery) {
    setDeletingId(item._id);
    setDeleteTarget(null);
    try {
      await deleteMutation({ id: item._id });
      toast.success("Query deleted");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleReorder(reordered: { id: string; sortOrder: number }[]) {
    if (reordering) return;
    setReordering(true);
    try {
      await reorderMutation({
        items: reordered.map((r) => ({
          id: r.id as Id<"predefinedSearchQueries">,
          sortOrder: r.sortOrder,
        })),
      });
    } catch {
      toast.error("Failed to reorder");
    } finally {
      setReordering(false);
    }
  }

  const isOpen = dialogState.mode !== "closed";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Predefined queries shown to shoppers in the search overlay.
        </p>
        <Button onClick={() => setDialogState({ mode: "create" })}>
          New Query
        </Button>
      </div>

      <Dialog
        open={isOpen}
        onOpenChange={(open) => !open && setDialogState({ mode: "closed" })}
      >
        {isOpen && (
          <SearchQueryDialog
            state={dialogState}
            onClose={() => setDialogState({ mode: "closed" })}
          />
        )}
      </Dialog>

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete &quot;{deleteTarget?.query}&quot;?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && handleDelete(deleteTarget)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {queries === undefined ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : queries.length === 0 ? (
        <p className="text-muted-foreground text-sm py-4">
          No predefined queries yet.
        </p>
      ) : (
        <div className="rounded-md border divide-y">
          <SortableList
            items={queries}
            onReorder={handleReorder}
            renderItem={(item, dragHandle) => (
              <div className="flex items-center gap-3 px-4 py-3 bg-background">
                {dragHandle}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{item.query}</p>
                  {!item.isActive && (
                    <p className="text-xs text-muted-foreground">Inactive</p>
                  )}
                </div>
                <RowActionsMenu
                  actions={[
                    {
                      label: "Edit",
                      icon: Pencil,
                      onClick: () => setDialogState({ mode: "edit", item }),
                    },
                    {
                      label: deletingId === item._id ? "Deleting…" : "Delete",
                      icon: Trash2,
                      variant: "destructive",
                      disabled: deletingId === item._id,
                      separator: true,
                      onClick: () => setDeleteTarget(item),
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

// ─── BundleDiscountsTab ───────────────────────────────────────

type DiscountType = "percentage" | "flat";

type TierFormState = {
  isActive: boolean;
  discountType: DiscountType;
  discountAmount: string;
  freeDelivery: boolean;
};

const DEFAULT_TIER: TierFormState = {
  isActive: false,
  discountType: "percentage",
  discountAmount: "0",
  freeDelivery: false,
};

function BundleDiscountsTab() {
  const config = useQuery(api.bundleDiscount.get);
  const upsert = useMutation(api.bundleDiscount.upsert);
  const [saving, setSaving] = useState(false);

  const [globalActive, setGlobalActive] = useState<boolean>(
    () => config?.isActive ?? false,
  );

  const [tier2, setTier2] = useState<TierFormState>(() => ({
    isActive: config?.tier2.isActive ?? false,
    discountType: config?.tier2.discountType ?? "percentage",
    discountAmount: String(config?.tier2.discountAmount ?? "0"),
    freeDelivery: config?.tier2.freeDelivery ?? false,
  }));
  const [tier3, setTier3] = useState<TierFormState>(() => ({
    isActive: config?.tier3.isActive ?? false,
    discountType: config?.tier3.discountType ?? "percentage",
    discountAmount: String(config?.tier3.discountAmount ?? "0"),
    freeDelivery: config?.tier3.freeDelivery ?? false,
  }));

  // Sync local state when Convex data first loads
  const [synced, setSynced] = useState(false);
  if (config !== undefined && !synced) {
    setSynced(true);
    if (config) {
      setGlobalActive(config.isActive);
      setTier2({
        isActive: config.tier2.isActive,
        discountType: config.tier2.discountType,
        discountAmount: String(config.tier2.discountAmount),
        freeDelivery: config.tier2.freeDelivery,
      });
      setTier3({
        isActive: config.tier3.isActive,
        discountType: config.tier3.discountType,
        discountAmount: String(config.tier3.discountAmount),
        freeDelivery: config.tier3.freeDelivery,
      });
    }
  }

  async function handleSave() {
    const t2Amount = parseFloat(tier2.discountAmount);
    const t3Amount = parseFloat(tier3.discountAmount);

    if (isNaN(t2Amount) || t2Amount < 0) {
      toast.error("Tier 2 discount amount must be a non-negative number");
      return;
    }
    if (isNaN(t3Amount) || t3Amount < 0) {
      toast.error("Tier 3 discount amount must be a non-negative number");
      return;
    }
    if (tier2.discountType === "percentage" && t2Amount > 100) {
      toast.error("Tier 2 percentage cannot exceed 100");
      return;
    }
    if (tier3.discountType === "percentage" && t3Amount > 100) {
      toast.error("Tier 3 percentage cannot exceed 100");
      return;
    }

    setSaving(true);
    try {
      await upsert({
        isActive: globalActive,
        tier2: {
          isActive: tier2.isActive,
          discountType: tier2.discountType,
          discountAmount: t2Amount,
          freeDelivery: tier2.freeDelivery,
        },
        tier3: {
          isActive: tier3.isActive,
          discountType: tier3.discountType,
          discountAmount: t3Amount,
          freeDelivery: tier3.freeDelivery,
        },
      });
      toast.success("Bundle discount settings saved");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  if (config === undefined) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading…
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-2xl">
      {/* Global toggle */}
      <div className="flex items-center justify-between rounded-lg border p-4">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <p className="font-medium">Bundle Discounts</p>
            <Badge variant={globalActive ? "default" : "secondary"}>
              {globalActive ? "Active" : "Inactive"}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Automatically discount orders when customers buy 2 or more items.
          </p>
        </div>
        <Switch checked={globalActive} onCheckedChange={setGlobalActive} />
      </div>

      {!globalActive && (
        <p className="text-sm text-muted-foreground rounded-md bg-muted px-4 py-3">
          Bundle discounts are currently disabled. Enable the master toggle
          above to activate them.
        </p>
      )}

      {/* Tier 2 */}
      <TierSection
        label="Tier 2 — 2 or more items"
        description="Applied when the cart contains at least 2 total items (quantity)."
        tier={tier2}
        onChange={setTier2}
        disabled={!globalActive}
      />

      {/* Tier 3 */}
      <TierSection
        label="Tier 3 — 3 or more items"
        description="Applied when the cart contains at least 3 total items. Overrides Tier 2 when both are active."
        tier={tier3}
        onChange={setTier3}
        disabled={!globalActive}
      />

      <Button onClick={handleSave} disabled={saving}>
        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Save Changes
      </Button>
    </div>
  );
}

function TierSection({
  label,
  description,
  tier,
  onChange,
  disabled,
}: {
  label: string;
  description: string;
  tier: TierFormState;
  onChange: (t: TierFormState) => void;
  disabled: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-5 space-y-5 ${disabled ? "opacity-50 pointer-events-none" : ""}`}
    >
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <p className="font-medium">{label}</p>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <Switch
          checked={tier.isActive}
          onCheckedChange={(v) => onChange({ ...tier, isActive: v })}
        />
      </div>

      <div
        className={`space-y-4 ${!tier.isActive ? "opacity-50 pointer-events-none" : ""}`}
      >
        {/* Discount type */}
        <div className="space-y-2">
          <Label>Discount Type</Label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name={`${label}-type`}
                value="percentage"
                checked={tier.discountType === "percentage"}
                onChange={() =>
                  onChange({ ...tier, discountType: "percentage" })
                }
              />
              <span className="text-sm">Percentage (%)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name={`${label}-type`}
                value="flat"
                checked={tier.discountType === "flat"}
                onChange={() => onChange({ ...tier, discountType: "flat" })}
              />
              <span className="text-sm">Flat Rate (৳)</span>
            </label>
          </div>
        </div>

        {/* Discount amount */}
        <div className="space-y-1">
          <Label htmlFor={`${label}-amount`}>
            Discount Amount{" "}
            <span className="text-muted-foreground font-normal">
              {tier.discountType === "percentage" ? "(1–100)" : "(৳ BDT)"}
            </span>
          </Label>
          <div className="relative w-48">
            <Input
              id={`${label}-amount`}
              type="number"
              min={0}
              max={tier.discountType === "percentage" ? 100 : undefined}
              step={tier.discountType === "percentage" ? 1 : 10}
              value={tier.discountAmount}
              onChange={(e) =>
                onChange({ ...tier, discountAmount: e.target.value })
              }
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm pointer-events-none">
              {tier.discountType === "percentage" ? "%" : "৳"}
            </span>
          </div>
        </div>

        {/* Free delivery */}
        <div className="flex items-center justify-between rounded-md border px-4 py-3">
          <div>
            <p className="text-sm font-medium">Free Delivery</p>
            <p className="text-xs text-muted-foreground">
              Mark orders reaching this tier as eligible for free delivery.
            </p>
          </div>
          <Switch
            checked={tier.freeDelivery}
            onCheckedChange={(v) => onChange({ ...tier, freeDelivery: v })}
          />
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Manage sizes, colors, navbar categories, predefined search queries,
          and bundle discounts.
        </p>
      </div>
      <Tabs defaultValue="sizes">
        <TabsList>
          <TabsTrigger value="sizes">Sizes</TabsTrigger>
          <TabsTrigger value="colors">Colors</TabsTrigger>
          <TabsTrigger value="navbar">Navbar</TabsTrigger>
          <TabsTrigger value="search">Search Queries</TabsTrigger>
          <TabsTrigger value="bundle">Bundle Discounts</TabsTrigger>
        </TabsList>
        <TabsContent value="sizes" className="mt-4">
          <SizesTab />
        </TabsContent>
        <TabsContent value="colors" className="mt-4">
          <ColorsTab />
        </TabsContent>
        <TabsContent value="navbar" className="mt-4">
          <NavbarTab />
        </TabsContent>
        <TabsContent value="search" className="mt-4">
          <SearchQueriesTab />
        </TabsContent>
        <TabsContent value="bundle" className="mt-4">
          <BundleDiscountsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
