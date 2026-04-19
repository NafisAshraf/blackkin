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
import { Loader2, Pencil, Trash2 } from "lucide-react";
import { SortableList } from "@/components/admin/SortableList";
import { RowActionsMenu } from "@/components/admin/RowActionsMenu";

// ─── Types ────────────────────────────────────────────────────

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

type SizeDialogState = { mode: "closed" } | { mode: "create" } | { mode: "edit"; size: PlatformSize };

function SizeDialog({ state, onClose }: { state: SizeDialogState; onClose: () => void }) {
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
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
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

// ─── SizesTab ─────────────────────────────────────────────────

function SizesTab() {
  const sizes = useQuery(api.platformConfig.listSizes);
  const deleteMutation = useMutation(api.platformConfig.deleteSize);
  const reorderMutation = useMutation(api.platformConfig.reorderSizes);

  const [dialogState, setDialogState] = useState<SizeDialogState>({ mode: "closed" });
  const [deleteTarget, setDeleteTarget] = useState<PlatformSize | null>(null);
  const [deletingId, setDeletingId] = useState<Id<"platformSizes"> | null>(null);
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
        items: reordered.map((r) => ({ id: r.id as Id<"platformSizes">, sortOrder: r.sortOrder })),
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
        <Button onClick={() => setDialogState({ mode: "create" })}>New Size</Button>
      </div>

      <Dialog open={isOpen} onOpenChange={(open) => !open && setDialogState({ mode: "closed" })}>
        {isOpen && <SizeDialog state={dialogState} onClose={() => setDialogState({ mode: "closed" })} />}
      </Dialog>

      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete size &quot;{deleteTarget?.name}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteTarget && handleDelete(deleteTarget)}>
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
        <p className="text-muted-foreground text-sm py-4">No sizes yet. Click &quot;New Size&quot; to add one.</p>
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
                    <p className="text-xs text-muted-foreground truncate">{size.measurements}</p>
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

type ColorDialogState = { mode: "closed" } | { mode: "create" } | { mode: "edit"; color: PlatformColor };

function ColorDialog({ state, onClose }: { state: ColorDialogState; onClose: () => void }) {
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
        await updateMutation({ id: state.color._id, name, hexCode });
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
          <Label htmlFor="color-hex">Hex Code <span className="text-destructive">*</span></Label>
          <div className="flex gap-2 items-center">
            <Input
              id="color-hex"
              value={hexCode}
              onChange={(e) => setHexCode(e.target.value)}
              placeholder="#000000"
              required
            />
            {hexCode && (
              <div className="w-8 h-8 rounded border shrink-0" style={{ backgroundColor: hexCode }} />
            )}
          </div>
          <p className="text-xs text-muted-foreground">Required. Enter a valid hex color code.</p>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
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

// ─── ColorsTab ────────────────────────────────────────────────

function ColorsTab() {
  const colors = useQuery(api.platformConfig.listColors);
  const deleteMutation = useMutation(api.platformConfig.deleteColor);
  const reorderMutation = useMutation(api.platformConfig.reorderColors);

  const [dialogState, setDialogState] = useState<ColorDialogState>({ mode: "closed" });
  const [deleteTarget, setDeleteTarget] = useState<PlatformColor | null>(null);
  const [deletingId, setDeletingId] = useState<Id<"platformColors"> | null>(null);
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
        items: reordered.map((r) => ({ id: r.id as Id<"platformColors">, sortOrder: r.sortOrder })),
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
        <Button onClick={() => setDialogState({ mode: "create" })}>New Color</Button>
      </div>

      <Dialog open={isOpen} onOpenChange={(open) => !open && setDialogState({ mode: "closed" })}>
        {isOpen && <ColorDialog state={dialogState} onClose={() => setDialogState({ mode: "closed" })} />}
      </Dialog>

      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete color &quot;{deleteTarget?.name}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteTarget && handleDelete(deleteTarget)}>
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
        <p className="text-muted-foreground text-sm py-4">No colors yet. Click &quot;New Color&quot; to add one.</p>
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
                      <p className="text-xs text-muted-foreground">{color.hexCode}</p>
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

// ─── Page ─────────────────────────────────────────────────────

export default function SizesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Platform Configuration</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Manage sizes and colors available across your store. Drag to reorder.
        </p>
      </div>

      <Tabs defaultValue="sizes">
        <TabsList>
          <TabsTrigger value="sizes">Sizes</TabsTrigger>
          <TabsTrigger value="colors">Colors</TabsTrigger>
        </TabsList>
        <TabsContent value="sizes" className="mt-4">
          <SizesTab />
        </TabsContent>
        <TabsContent value="colors" className="mt-4">
          <ColorsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
