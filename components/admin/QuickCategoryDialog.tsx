"use client";

import { useState, useEffect } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";

function slugify(str: string) {
  return str.toLowerCase().trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

interface QuickCategoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** If provided, switches to edit mode */
  editId?: Id<"categories">;
  editName?: string;
}

export function QuickCategoryDialog({
  open,
  onOpenChange,
  editId,
  editName,
}: QuickCategoryDialogProps) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugManual, setSlugManual] = useState(false);
  const [saving, setSaving] = useState(false);

  const createCategory = useMutation(api.categories.create);
  const updateCategory = useMutation(api.categories.update);

  const isEdit = !!editId;

  useEffect(() => {
    if (open) {
      setName(editName ?? "");
      setSlug(editName ? slugify(editName) : "");
      setSlugManual(false);
    }
  }, [open, editName]);

  function handleNameChange(val: string) {
    setName(val);
    if (!slugManual) setSlug(slugify(val));
  }

  async function handleSave() {
    if (!name.trim()) { toast.error("Category name is required"); return; }
    setSaving(true);
    try {
      if (isEdit) {
        await updateCategory({ id: editId!, name: name.trim(), slug: slug.trim() || slugify(name) });
        toast.success("Category updated");
      } else {
        await createCategory({ name: name.trim(), slug: slug.trim() || slugify(name) });
        toast.success("Category created");
      }
      onOpenChange(false);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to save category");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Category" : "New Category"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="cat-name">Name *</Label>
            <Input id="cat-name" value={name} onChange={(e) => handleNameChange(e.target.value)} placeholder="e.g. Underwear" autoFocus />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cat-slug">Slug</Label>
            <Input id="cat-slug" value={slug} onChange={(e) => { setSlug(e.target.value); setSlugManual(true); }} placeholder="underwear" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {isEdit ? "Save" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
