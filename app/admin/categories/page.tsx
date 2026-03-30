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
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Loader2, Pencil, Trash2, ToggleLeft, ToggleRight } from "lucide-react";
import { SortableList } from "@/components/admin/SortableList";
import { RowActionsMenu } from "@/components/admin/RowActionsMenu";

function toSlug(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

type Category = {
  _id: Id<"categories">;
  _creationTime: number;
  name: string;
  slug: string;
  description?: string;
  isActive: boolean;
  sortOrder: number;
};

type DialogState = { mode: "closed" } | { mode: "create" } | { mode: "edit"; category: Category };

function CategoryDialog({ state, onClose }: { state: DialogState; onClose: () => void }) {
  const isEdit = state.mode === "edit";
  const initial = isEdit ? state.category : null;

  const [name, setName] = useState(initial?.name ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [loading, setLoading] = useState(false);

  const createMutation = useMutation(api.categories.create);
  const updateMutation = useMutation(api.categories.update);

  function handleNameChange(val: string) {
    setName(val);
    if (!isEdit) setSlug(toSlug(val));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (isEdit) {
        await updateMutation({ id: state.category._id, name, slug, description: description || undefined });
        toast.success("Category updated");
      } else {
        await createMutation({ name, slug, description: description || undefined });
        toast.success("Category created");
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
        <DialogTitle>{isEdit ? "Edit Category" : "New Category"}</DialogTitle>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1">
          <Label htmlFor="cat-name">Name</Label>
          <Input id="cat-name" value={name} onChange={(e) => handleNameChange(e.target.value)} required />
        </div>
        <div className="space-y-1">
          <Label htmlFor="cat-slug">Slug</Label>
          <Input id="cat-slug" value={slug} onChange={(e) => setSlug(e.target.value)} required />
        </div>
        <div className="space-y-1">
          <Label htmlFor="cat-desc">Description</Label>
          <Textarea id="cat-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button type="submit" disabled={loading}>{loading ? "Saving…" : isEdit ? "Update" : "Create"}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

export default function CategoriesPage() {
  const categories = useQuery(api.categories.listAll);
  const toggleActiveMutation = useMutation(api.categories.toggleActive);
  const reorderMutation = useMutation(api.categories.reorder);

  const [dialogState, setDialogState] = useState<DialogState>({ mode: "closed" });
  const [togglingId, setTogglingId] = useState<Id<"categories"> | null>(null);
  const [reordering, setReordering] = useState(false);

  async function handleToggleActive(cat: Category) {
    setTogglingId(cat._id);
    try {
      await toggleActiveMutation({ id: cat._id, isActive: !cat.isActive });
      toast.success(`Category ${cat.isActive ? "deactivated" : "activated"}`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setTogglingId(null);
    }
  }

  async function handleReorder(reordered: { id: string; sortOrder: number }[]) {
    if (reordering) return;
    setReordering(true);
    try {
      await reorderMutation({
        items: reordered.map((r) => ({ id: r.id as Id<"categories">, sortOrder: r.sortOrder })),
      });
    } catch {
      toast.error("Failed to reorder");
    } finally {
      setReordering(false);
    }
  }

  const isOpen = dialogState.mode !== "closed";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Categories</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage product categories. Drag to reorder.</p>
        </div>
        <Button onClick={() => setDialogState({ mode: "create" })}>New Category</Button>
      </div>

      <Dialog open={isOpen} onOpenChange={(open) => !open && setDialogState({ mode: "closed" })}>
        {isOpen && <CategoryDialog state={dialogState} onClose={() => setDialogState({ mode: "closed" })} />}
      </Dialog>

      {categories === undefined ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : categories.length === 0 ? (
        <p className="text-muted-foreground text-sm py-4">No categories yet.</p>
      ) : (
        <div className="rounded-md border divide-y">
          <SortableList
            items={categories}
            onReorder={handleReorder}
            renderItem={(cat, dragHandle) => (
              <div className="flex items-center gap-3 px-4 py-3 bg-background">
                {dragHandle}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm">{cat.name}</p>
                    <Badge variant={cat.isActive ? "default" : "secondary"} className="text-xs">
                      {cat.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{cat.slug}</p>
                </div>
                <RowActionsMenu
                  actions={[
                    {
                      label: "Edit",
                      icon: Pencil,
                      onClick: () => setDialogState({ mode: "edit", category: cat }),
                    },
                    {
                      label: togglingId === cat._id
                        ? "Updating…"
                        : cat.isActive ? "Deactivate" : "Activate",
                      icon: cat.isActive ? ToggleLeft : ToggleRight,
                      disabled: togglingId === cat._id,
                      separator: true,
                      onClick: () => handleToggleActive(cat),
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
