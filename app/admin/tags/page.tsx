"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { Loader2, Pencil, Trash2, ToggleLeft, ToggleRight } from "lucide-react";
import { RowActionsMenu } from "@/components/admin/RowActionsMenu";

function toSlug(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

type Tag = { _id: Id<"tags">; _creationTime: number; name: string; slug: string; isActive: boolean };
type TagDialogState = { mode: "closed" } | { mode: "create" } | { mode: "edit"; tag: Tag };

function TagDialog({ state, onClose }: { state: TagDialogState; onClose: () => void }) {
  const isEdit = state.mode === "edit";
  const initial = isEdit ? state.tag : null;

  const [name, setName] = useState(initial?.name ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [loading, setLoading] = useState(false);

  const createMutation = useMutation(api.tags.create);
  const updateMutation = useMutation(api.tags.update);

  function handleNameChange(val: string) {
    setName(val);
    if (!isEdit) setSlug(toSlug(val));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (isEdit) {
        await updateMutation({ id: state.tag._id, name, slug });
        toast.success("Tag updated");
      } else {
        await createMutation({ name, slug });
        toast.success("Tag created");
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
      <DialogHeader><DialogTitle>{isEdit ? "Edit Tag" : "New Tag"}</DialogTitle></DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1">
          <Label htmlFor="tag-name">Name</Label>
          <Input id="tag-name" value={name} onChange={(e) => handleNameChange(e.target.value)} required />
        </div>
        <div className="space-y-1">
          <Label htmlFor="tag-slug">Slug</Label>
          <Input id="tag-slug" value={slug} onChange={(e) => setSlug(e.target.value)} required />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button type="submit" disabled={loading}>{loading ? "Saving…" : isEdit ? "Update" : "Create"}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

export default function TagsPage() {
  const tags = useQuery(api.tags.listAll);
  const removeMutation = useMutation(api.tags.remove);
  const toggleActiveMutation = useMutation(api.tags.toggleActive);

  const [dialogState, setDialogState] = useState<TagDialogState>({ mode: "closed" });
  const [deleteTarget, setDeleteTarget] = useState<Tag | null>(null);
  const [togglingId, setTogglingId] = useState<Id<"tags"> | null>(null);
  const [deletingId, setDeletingId] = useState<Id<"tags"> | null>(null);

  async function handleToggleActive(tag: Tag) {
    setTogglingId(tag._id);
    try {
      await toggleActiveMutation({ id: tag._id, isActive: !tag.isActive });
      toast.success(`Tag ${tag.isActive ? "deactivated" : "activated"}`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setTogglingId(null);
    }
  }

  async function handleDelete(tag: Tag) {
    setDeletingId(tag._id);
    setDeleteTarget(null);
    try {
      await removeMutation({ id: tag._id });
      toast.success("Tag deleted");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setDeletingId(null);
    }
  }

  const isOpen = dialogState.mode !== "closed";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Tags</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage product tags</p>
        </div>
        <Button onClick={() => setDialogState({ mode: "create" })}>New Tag</Button>
      </div>

      <Dialog open={isOpen} onOpenChange={(open) => !open && setDialogState({ mode: "closed" })}>
        {isOpen && <TagDialog state={dialogState} onClose={() => setDialogState({ mode: "closed" })} />}
      </Dialog>

      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete tag &quot;{deleteTarget?.name}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the tag and remove it from all products.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteTarget && handleDelete(deleteTarget)}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {tags === undefined ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : tags.length === 0 ? (
        <p className="text-muted-foreground text-sm py-4">No tags yet.</p>
      ) : (
        <div className="rounded-md border divide-y">
          {tags.map((tag) => (
            <div key={tag._id} className="flex items-center gap-3 px-4 py-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-sm">{tag.name}</p>
                  <Badge variant={tag.isActive ? "default" : "secondary"} className="text-xs">
                    {tag.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">{tag.slug}</p>
              </div>
              <RowActionsMenu
                actions={[
                  {
                    label: "Edit",
                    icon: Pencil,
                    onClick: () => setDialogState({ mode: "edit", tag }),
                  },
                  {
                    label: togglingId === tag._id ? "Updating…" : tag.isActive ? "Deactivate" : "Activate",
                    icon: tag.isActive ? ToggleLeft : ToggleRight,
                    disabled: togglingId === tag._id,
                    separator: true,
                    onClick: () => handleToggleActive(tag),
                  },
                  {
                    label: deletingId === tag._id ? "Deleting…" : "Delete",
                    icon: Trash2,
                    variant: "destructive",
                    disabled: deletingId === tag._id,
                    onClick: () => setDeleteTarget(tag),
                  },
                ]}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
