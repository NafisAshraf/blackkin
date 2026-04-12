"use client";

import { useRef, useState, useCallback } from "react";
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
import { Loader2, Pencil, Trash2, Upload, ToggleLeft, ToggleRight, MoreHorizontal } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SortableList } from "@/components/admin/SortableList";

// ─── Image slot metadata ────────────────────────────────────────────────────
type ImageSlot =
  | "hero"
  | "splitImage"
  | "tech1"
  | "tech2"
  | "tech3";

const IMAGE_SLOTS: { slot: ImageSlot; label: string; description: string }[] = [
  {
    slot: "hero",
    label: "Hero Banner",
    description: 'Full-screen background image behind "BE BOLD"',
  },
  {
    slot: "splitImage",
    label: "Split Section Image",
    description: "Right side of the dark/image split section",
  },
  {
    slot: "tech1",
    label: "Technology Image 1",
    description: "Graphene Antibacterial Inner Crotch",
  },
  {
    slot: "tech2",
    label: "Technology Image 2",
    description: "Dynamic Stretch",
  },
  {
    slot: "tech3",
    label: "Technology Image 3",
    description: "Wormwood Essential Oil Care",
  },
];

// ─── Types ──────────────────────────────────────────────────────────────────
type Quote = {
  _id: Id<"landingPageQuotes">;
  _creationTime: number;
  text: string;
  author: string;
  isActive: boolean;
};

type QuoteDialogState =
  | { mode: "closed" }
  | { mode: "add" }
  | { mode: "edit"; quote: Quote };

// ─── Quote Dialog ───────────────────────────────────────────────────────────
function QuoteDialog({
  state,
  onClose,
}: {
  state: QuoteDialogState;
  onClose: () => void;
}) {
  const isEdit = state.mode === "edit";
  const initial = isEdit ? state.quote : null;

  const [text, setText] = useState(initial?.text ?? "");
  const [author, setAuthor] = useState(initial?.author ?? "");
  const [loading, setLoading] = useState(false);

  const addMutation = useMutation(api.landingPage.addQuote);
  const updateMutation = useMutation(api.landingPage.updateQuote);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || !author.trim()) return;
    setLoading(true);
    try {
      if (isEdit) {
        await updateMutation({ id: state.quote._id, text: text.trim(), author: author.trim() });
        toast.success("Quote updated");
      } else {
        await addMutation({ text: text.trim(), author: author.trim() });
        toast.success("Quote added");
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
        <DialogTitle>{isEdit ? "Edit Quote" : "Add Quote"}</DialogTitle>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1">
          <Label htmlFor="quote-text">Quote Text</Label>
          <Textarea
            id="quote-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Enter the customer quote…"
            rows={4}
            required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="quote-author">Author Name</Label>
          <Input
            id="quote-author"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            placeholder="e.g. Farhan Ahmed"
            required
          />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? "Saving…" : isEdit ? "Update" : "Add Quote"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

// ─── Product Section Editor ─────────────────────────────────────────────────
type AdminSectionProduct = {
  _id: Id<"landingPageProductSectionItems">;
  productId: Id<"products">;
  name: string;
  slug: string;
  imageUrl: string | null;
  sortOrder: number;
};

type AdminSection = {
  _id: Id<"landingPageProductSections"> | null;
  position: 1 | 2;
  heading: string;
  isActive: boolean;
  tagId: Id<"tags"> | null;
  tagName: string | null;
  products: AdminSectionProduct[];
};

const SECTION_LABELS: Record<number, { title: string; description: string }> = {
  1: {
    title: "Product Section 1",
    description: 'Displayed below the "Crafted for the Modern Man" section',
  },
  2: {
    title: "Product Section 2",
    description: "Displayed below the dark/image split section",
  },
};

function ProductSectionEditor({ section }: { section: AdminSection }) {
  const meta = SECTION_LABELS[section.position] ?? {
    title: `Section ${section.position}`,
    description: "",
  };

  const [heading, setHeading] = useState(section.heading);
  const [isSaving, setIsSaving] = useState(false);
  const [isToggling, setIsToggling] = useState(false);
  const [isSettingTag, setIsSettingTag] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const upsertSection = useMutation(api.landingPage.upsertProductSection);
  const toggleSection = useMutation(api.landingPage.toggleProductSection);
  const setTagForSection = useMutation(api.landingPage.setTagForSection);
  const clearSectionMutation = useMutation(api.landingPage.clearSection);
  const reorderProducts = useMutation(api.landingPage.reorderSectionProducts);

  const allTags = useQuery(api.tags.listAll);

  async function handleSaveHeading() {
    if (!heading.trim()) return;
    setIsSaving(true);
    try {
      await upsertSection({ position: section.position, heading: heading.trim() });
      toast.success("Section heading updated");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleToggle() {
    if (!section._id) {
      toast.error("Save a heading first to enable the section");
      return;
    }
    setIsToggling(true);
    try {
      await toggleSection({ id: section._id });
      toast.success(section.isActive ? "Section hidden" : "Section visible");
    } catch {
      toast.error("Failed to toggle section");
    } finally {
      setIsToggling(false);
    }
  }

  async function handleSetTag(tagId: string) {
    if (!section._id) {
      toast.error("Save a heading first before setting a tag");
      return;
    }
    if (tagId === section.tagId) return;
    setIsSettingTag(true);
    try {
      await setTagForSection({
        sectionId: section._id,
        tagId: tagId as Id<"tags">,
      });
      toast.success("Tag set — products updated");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to set tag");
    } finally {
      setIsSettingTag(false);
    }
  }

  async function handleClearSection() {
    if (!section._id) return;
    setIsClearing(true);
    try {
      await clearSectionMutation({ sectionId: section._id });
      toast.success("Section cleared");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to clear section");
    } finally {
      setIsClearing(false);
      setShowClearConfirm(false);
    }
  }

  const handleReorder = useCallback(
    async (reordered: { id: string; sortOrder: number }[]) => {
      try {
        await reorderProducts({
          items: reordered.map((r) => ({
            id: r.id as Id<"landingPageProductSectionItems">,
            sortOrder: r.sortOrder,
          })),
        });
      } catch {
        toast.error("Failed to reorder");
      }
    },
    [reorderProducts]
  );

  const canClear = !!(section._id && (section.tagId || section.products.length > 0));

  return (
    <div className="border border-border overflow-hidden">
      {/* Section header */}
      <div className="px-4 pt-5 pb-3 flex items-start justify-between border-b border-border">
        <div>
          <p className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground mb-0.5">
            {section.position === 1 ? "Section 02" : "Section 03"}
          </p>
          <p className="text-sm font-thin tracking-[0.2em] uppercase text-foreground">
            {meta.title}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5 italic">
            {meta.description}
          </p>
        </div>
        <div className="flex items-center gap-1 mt-0.5">
          {section._id && (
            <Badge
              variant={section.isActive ? "default" : "secondary"}
              className="text-[9px] tracking-[0.1em] uppercase"
            >
              {section.isActive ? "Visible" : "Hidden"}
            </Badge>
          )}
          {/* 3-dots menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild disabled={!canClear}>
              <button
                className="h-7 w-7 flex items-center justify-center hover:bg-muted transition-colors text-muted-foreground hover:text-foreground disabled:opacity-50"
                title="Section options"
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-36">
              <DropdownMenuItem
                className="text-xs text-red-600 focus:text-red-600 cursor-pointer"
                onClick={() => setShowClearConfirm(true)}
              >
                Clear Section
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {/* Visibility toggle */}
          <button
            className="h-7 w-7 flex items-center justify-center hover:bg-muted transition-colors text-muted-foreground hover:text-foreground disabled:opacity-50"
            title={section.isActive ? "Hide section" : "Show section"}
            disabled={isToggling || !section._id || (!section.tagId && !section.isActive)}
            onClick={handleToggle}
          >
            {isToggling ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : section.isActive ? (
              <ToggleRight className="h-3.5 w-3.5" />
            ) : (
              <ToggleLeft className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Heading Input */}
        <div className="flex gap-2">
          <Input
            placeholder="Section heading, e.g. BEST SELLERS"
            value={heading}
            onChange={(e) => setHeading(e.target.value)}
            className="flex-1"
          />
          <Button
            size="sm"
            onClick={handleSaveHeading}
            disabled={isSaving || !heading.trim() || heading.trim() === section.heading}
          >
            {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save"}
          </Button>
        </div>

        {/* Tag Selector */}
        {section._id && (
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Products Tag</Label>
            <div className="flex items-center gap-2">
              <Select
                value={section.tagId ?? ""}
                onValueChange={handleSetTag}
                disabled={isSettingTag}
              >
                <SelectTrigger className="flex-1 h-8 text-xs">
                  <SelectValue placeholder="Select a tag to populate this section" />
                </SelectTrigger>
                <SelectContent>
                  {(allTags ?? []).map((tag) => (
                    <SelectItem key={tag._id} value={tag._id} className="text-xs">
                      {tag.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {isSettingTag && (
                <Loader2 className="h-3.5 w-3.5 animate-spin flex-shrink-0 text-muted-foreground" />
              )}
            </div>
            {section.tagId && (
              <p className="text-[10px] text-muted-foreground">
                {section.products.length} product{section.products.length !== 1 ? "s" : ""} from{" "}
                <span className="font-medium text-foreground">{section.tagName}</span>
              </p>
            )}
          </div>
        )}

        {/* Sortable product list */}
        {section.products.length > 0 && (
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Drag to Reorder</Label>
            <div className="border border-border divide-y">
              <SortableList
                items={section.products}
                onReorder={handleReorder}
                renderItem={(item, dragHandle) => (
                  <div className="flex items-center gap-2 px-3 py-2 bg-background">
                    {dragHandle}
                    {item.imageUrl && (
                      <img
                        src={item.imageUrl}
                        alt={item.name}
                        className="w-8 h-8 object-cover flex-shrink-0"
                      />
                    )}
                    <span className="text-sm flex-1 truncate">{item.name}</span>
                  </div>
                )}
              />
            </div>
          </div>
        )}

        {/* Empty states */}
        {!section._id && (
          <p className="text-xs text-muted-foreground py-2">
            Save a heading to start configuring this section.
          </p>
        )}
        {section._id && !section.tagId && (
          <p className="text-xs text-muted-foreground py-2">
            Select a tag above to populate this section with products.
          </p>
        )}
        {section._id && section.tagId && section.products.length === 0 && (
          <p className="text-xs text-muted-foreground py-2">
            This tag has no products assigned yet.
          </p>
        )}
      </div>

      {/* Clear Section Confirmation */}
      <AlertDialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear Section?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the tag and all products from this section. The section will remain hidden until a new tag is selected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isClearing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClearSection}
              disabled={isClearing}
              className="bg-red-600 hover:bg-red-700"
            >
              {isClearing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                "Clear Section"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────
export default function LandingPageCmsPage() {
  // Image data
  const imageRows = useQuery(api.landingPage.adminGetImages);
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const updateImage = useMutation(api.landingPage.updateImage);

  // Quote data
  const quotes = useQuery(api.landingPage.adminGetAllQuotes);
  const toggleQuote = useMutation(api.landingPage.toggleQuoteActive);
  const deleteQuote = useMutation(api.landingPage.deleteQuote);

  // Product sections data
  const productSections = useQuery(api.landingPage.adminGetProductSections);

  // Upload tracking: slot → true while uploading
  const [uploading, setUploading] = useState<Partial<Record<ImageSlot, boolean>>>({});
  const fileInputRefs = useRef<Partial<Record<ImageSlot, HTMLInputElement | null>>>({});

  // Quote dialog
  const [quoteDialog, setQuoteDialog] = useState<QuoteDialogState>({ mode: "closed" });
  const [deleteTarget, setDeleteTarget] = useState<Quote | null>(null);
  const [togglingId, setTogglingId] = useState<Id<"landingPageQuotes"> | null>(null);
  const [deletingId, setDeletingId] = useState<Id<"landingPageQuotes"> | null>(null);

  // Build a map of slot → current URL for easy lookup
  const imageMap = Object.fromEntries(
    (imageRows ?? []).map((r) => [r.slot, r.url])
  ) as Partial<Record<ImageSlot, string | null>>;

  // ── Image upload handler ──────────────────────────────────────────────────
  async function handleFileChange(slot: ImageSlot, file: File) {
    setUploading((prev) => ({ ...prev, [slot]: true }));
    try {
      const uploadUrl = await generateUploadUrl();
      const response = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!response.ok) throw new Error("Upload failed");
      const { storageId } = await response.json();
      await updateImage({ slot, storageId });
      toast.success(`${IMAGE_SLOTS.find((s) => s.slot === slot)?.label} updated`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading((prev) => ({ ...prev, [slot]: false }));
      const input = fileInputRefs.current[slot];
      if (input) input.value = "";
    }
  }

  // ── Quote action handlers ─────────────────────────────────────────────────
  async function handleToggleQuote(quote: Quote) {
    setTogglingId(quote._id);
    try {
      await toggleQuote({ id: quote._id });
      toast.success(quote.isActive ? "Quote hidden" : "Quote shown");
    } catch {
      toast.error("Failed to update quote");
    } finally {
      setTogglingId(null);
    }
  }

  async function handleDeleteQuote(quote: Quote) {
    setDeletingId(quote._id);
    try {
      await deleteQuote({ id: quote._id });
      toast.success("Quote deleted");
    } catch {
      toast.error("Failed to delete quote");
    } finally {
      setDeletingId(null);
      setDeleteTarget(null);
    }
  }

  const isQuoteDialogOpen = quoteDialog.mode !== "closed";

  return (
    <div className="space-y-10">
      {/* ── Page header ── */}
      <div className="border-b border-border pb-8">
        <p className="text-[10px] tracking-[0.35em] uppercase text-muted-foreground mb-2">
          Admin CMS
        </p>
        <h1 className="text-3xl md:text-4xl font-thin tracking-[0.22em] uppercase text-foreground">
          Landing Page
        </h1>
        <p className="text-xs text-muted-foreground mt-3 tracking-wide max-w-xl">
          Each section below mirrors the visual layout it controls on the homepage.
          Upload images, configure product showcases, and manage testimonial quotes.
        </p>
      </div>

      {/* ── Images section ── */}
      <section className="space-y-6">
        <div>
          <p className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground mb-1">
            Section 01
          </p>
          <h2 className="text-base font-thin tracking-[0.2em] uppercase text-foreground">
            Section Images
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Upload replacement images for each homepage section. Changes are live immediately.
          </p>
        </div>

        {imageRows === undefined ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading images…
          </div>
        ) : (
          <div className="space-y-8">

            {/* ── Row A: Hero Banner (full-width 16:9, gradient + "BE BOLD" overlay) ── */}
            <div className="space-y-2">
              <p className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground">
                Hero — &ldquo;BE BOLD&rdquo;
              </p>
              {(() => {
                const { slot, label } = IMAGE_SLOTS[0];
                const currentUrl = imageMap[slot];
                const isUploading = uploading[slot] ?? false;
                return (
                  <div className="relative w-full aspect-video overflow-hidden bg-black">
                    {currentUrl ? (
                      <img src={currentUrl} alt={label} className="w-full h-full object-cover object-center" />
                    ) : (
                      <div className="w-full h-full bg-neutral-900 flex items-center justify-center">
                        <Upload className="h-8 w-8 text-white/20" />
                      </div>
                    )}
                    {/* Gradient overlay — exact match from app/page.tsx */}
                    <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/30 to-transparent" />
                    {/* Overlaid text — bottom left, like the real hero */}
                    <div className="absolute bottom-5 left-6 z-10 pointer-events-none">
                      <p className="text-white/70 text-[9px] tracking-[0.3em] uppercase mb-1">Premium Comfort</p>
                      <p className="text-white text-2xl font-bold tracking-tight leading-none">BE<br />BOLD</p>
                    </div>
                    {/* Upload badge — top right */}
                    <button
                      className="absolute top-3 right-3 z-20 flex items-center gap-1.5 bg-black/60 hover:bg-black/80 text-white text-[10px] tracking-[0.15em] uppercase px-3 py-1.5 transition-colors disabled:opacity-50"
                      disabled={isUploading}
                      onClick={() => fileInputRefs.current[slot]?.click()}
                    >
                      {isUploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                      {currentUrl ? "Replace" : "Upload"}
                    </button>
                    {isUploading && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10">
                        <Loader2 className="h-6 w-6 animate-spin text-white" />
                      </div>
                    )}
                    <div className="absolute bottom-0 right-0 z-10 bg-black/40 px-3 py-1.5 pointer-events-none">
                      <p className="text-white text-[9px] tracking-[0.2em] uppercase">{label}</p>
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      ref={(el) => { fileInputRefs.current[slot] = el; }}
                      onChange={(e) => { const file = e.target.files?.[0]; if (file) handleFileChange(slot, file); }}
                    />
                  </div>
                );
              })()}
            </div>

            {/* ── Row B: Split Section (2-col: dark left / image right) ── */}
            <div className="space-y-2">
              <p className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground">
                Split Section — Dark Left / Image Right
              </p>
              {(() => {
                const { slot, label } = IMAGE_SLOTS[1];
                const currentUrl = imageMap[slot];
                const isUploading = uploading[slot] ?? false;
                return (
                  <div className="grid grid-cols-2 w-full h-48 md:h-64">
                    {/* Left: dark panel with static text — mirrors actual dark side */}
                    <div className="bg-[#111111] flex flex-col justify-end p-5">
                      <p className="text-white text-sm font-bold uppercase tracking-[0.06em] leading-snug">
                        Upgrade the way<br />you feel
                      </p>
                      <p className="text-white/40 text-[9px] tracking-[0.2em] uppercase mt-2">
                        Static — no upload needed
                      </p>
                    </div>
                    {/* Right: portrait image upload */}
                    <div className="relative overflow-hidden bg-neutral-800">
                      {currentUrl ? (
                        <img src={currentUrl} alt={label} className="w-full h-full object-cover object-center" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Upload className="h-8 w-8 text-white/20" />
                        </div>
                      )}
                      <button
                        className="absolute top-2 right-2 z-10 flex items-center gap-1 bg-black/60 hover:bg-black/80 text-white text-[10px] tracking-[0.1em] uppercase px-2.5 py-1.5 transition-colors disabled:opacity-50"
                        disabled={isUploading}
                        onClick={() => fileInputRefs.current[slot]?.click()}
                      >
                        {isUploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                        {currentUrl ? "Replace" : "Upload"}
                      </button>
                      {isUploading && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                          <Loader2 className="h-6 w-6 animate-spin text-white" />
                        </div>
                      )}
                      <div className="absolute bottom-0 left-0 right-0 bg-black/40 px-3 py-1.5 pointer-events-none">
                        <p className="text-white text-[9px] tracking-[0.2em] uppercase">{label}</p>
                      </div>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        ref={(el) => { fileInputRefs.current[slot] = el; }}
                        onChange={(e) => { const file = e.target.files?.[0]; if (file) handleFileChange(slot, file); }}
                      />
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* ── Row D: Technology Section (3-col, 3:4 portrait grid) ── */}
            <div className="space-y-2">
              <p className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground">
                Premium Comfort Technology — 3 Images
              </p>
              <div className="grid grid-cols-3 gap-0 border border-border">
                {IMAGE_SLOTS.slice(2).map(({ slot, label, description }) => {
                  const currentUrl = imageMap[slot];
                  const isUploading = uploading[slot] ?? false;
                  return (
                    <div key={slot} className="flex flex-col border-r border-border last:border-r-0">
                      {/* Portrait 3:4 image — matches actual tech section grid */}
                      <div className="relative aspect-[3/4] overflow-hidden bg-neutral-100">
                        {currentUrl ? (
                          <img src={currentUrl} alt={label} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-neutral-100">
                            <Upload className="h-6 w-6 text-muted-foreground/30" />
                          </div>
                        )}
                        {/* Icon-only upload badge */}
                        <button
                          className="absolute top-2 right-2 z-10 flex items-center justify-center bg-black/60 hover:bg-black/80 text-white w-6 h-6 transition-colors disabled:opacity-50"
                          disabled={isUploading}
                          onClick={() => fileInputRefs.current[slot]?.click()}
                          title={currentUrl ? "Replace image" : "Upload image"}
                        >
                          {isUploading ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Upload className="h-2.5 w-2.5" />}
                        </button>
                        {isUploading && (
                          <div className="absolute inset-0 bg-background/70 flex items-center justify-center">
                            <Loader2 className="h-5 w-5 animate-spin" />
                          </div>
                        )}
                      </div>
                      {/* Text below — mirrors actual tech section card layout */}
                      <div className="py-3 px-3 bg-background text-center">
                        <p className="text-xs text-foreground tracking-wide leading-snug">{label}</p>
                        <p className="text-[10px] text-muted-foreground mt-1 leading-relaxed">{description}</p>
                        <button
                          className="mt-2 text-[9px] tracking-[0.15em] uppercase text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                          disabled={isUploading}
                          onClick={() => fileInputRefs.current[slot]?.click()}
                        >
                          {currentUrl ? "Replace Image" : "Upload Image"}
                        </button>
                      </div>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        ref={(el) => { fileInputRefs.current[slot] = el; }}
                        onChange={(e) => { const file = e.target.files?.[0]; if (file) handleFileChange(slot, file); }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        )}
      </section>

      {/* ── Product Showcase Sections ── */}
      <section className="space-y-4">
        <div className="border-b border-border pb-4">
          <p className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground mb-1">
            Section 02 — 03
          </p>
          <h2 className="text-base font-thin tracking-[0.2em] uppercase text-foreground">
            Product Showcases
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Two configurable product carousels. Set a heading, add products, drag to reorder, toggle visibility.
          </p>
        </div>

        {productSections === undefined ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading sections…
          </div>
        ) : (
          <div className="space-y-4">
            {(productSections as AdminSection[]).map((section) => (
              <ProductSectionEditor key={section.position} section={section} />
            ))}
          </div>
        )}
      </section>

      {/* ── Quotes section ── */}
      <section className="space-y-4">
        <div className="flex items-end justify-between border-b border-border pb-4">
          <div>
            <p className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground mb-1">
              Section 04
            </p>
            <h2 className="text-base font-thin tracking-[0.2em] uppercase text-foreground">
              Quote Carousel
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Displayed on the <span className="italic">light gray</span> section at the bottom of the page
            </p>
          </div>
          <button
            onClick={() => setQuoteDialog({ mode: "add" })}
            className="text-[10px] tracking-[0.2em] uppercase text-foreground border border-foreground px-4 py-2 hover:bg-foreground hover:text-background transition-colors flex-shrink-0"
          >
            Add Quote
          </button>
        </div>

        <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete quote by &quot;{deleteTarget?.author}&quot;?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently remove the quote from the homepage carousel.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => deleteTarget && handleDeleteQuote(deleteTarget)}>
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Dialog
          open={isQuoteDialogOpen}
          onOpenChange={(open) => !open && setQuoteDialog({ mode: "closed" })}
        >
          {isQuoteDialogOpen && (
            <QuoteDialog
              state={quoteDialog}
              onClose={() => setQuoteDialog({ mode: "closed" })}
            />
          )}
        </Dialog>

        {quotes === undefined ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading quotes…
          </div>
        ) : quotes.length === 0 ? (
          <div className="bg-[#f5f5f5] p-8 text-center">
            <div className="text-4xl text-gray-300 font-serif leading-none mb-3 select-none">&rdquo;</div>
            <p className="text-xs text-muted-foreground tracking-wide">
              No quotes yet. Add your first testimonial above.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {quotes.map((quote) => (
              <div
                key={quote._id}
                className={`bg-[#f5f5f5] p-6 flex flex-col transition-opacity ${
                  quote.isActive ? "opacity-100" : "opacity-40"
                }`}
              >
                {/* Large quotation mark — matching QuoteCarousel.tsx */}
                <div className="text-5xl text-gray-300 font-serif leading-none select-none mb-4">
                  &rdquo;
                </div>
                {/* Quote text */}
                <p className="text-sm text-foreground leading-relaxed tracking-wide flex-1">
                  {quote.text}
                </p>
                {/* Author */}
                <p className="mt-4 text-xs text-muted-foreground tracking-[0.1em]">
                  &mdash; {quote.author}
                </p>
                {/* Action bar */}
                <div className="mt-4 pt-3 border-t border-black/10 flex items-center justify-between">
                  <Badge
                    variant={quote.isActive ? "default" : "secondary"}
                    className="text-[9px] tracking-[0.1em] uppercase"
                  >
                    {quote.isActive ? "Visible" : "Hidden"}
                  </Badge>
                  <div className="flex items-center gap-1">
                    {/* Toggle */}
                    <button
                      className="h-7 w-7 flex items-center justify-center hover:bg-black/10 transition-colors text-muted-foreground hover:text-foreground disabled:opacity-50"
                      title={quote.isActive ? "Hide quote" : "Show quote"}
                      disabled={togglingId === quote._id}
                      onClick={() => handleToggleQuote(quote)}
                    >
                      {togglingId === quote._id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : quote.isActive ? (
                        <ToggleRight className="h-3.5 w-3.5" />
                      ) : (
                        <ToggleLeft className="h-3.5 w-3.5" />
                      )}
                    </button>
                    {/* Edit */}
                    <button
                      className="h-7 w-7 flex items-center justify-center hover:bg-black/10 transition-colors text-muted-foreground hover:text-foreground"
                      title="Edit quote"
                      onClick={() => setQuoteDialog({ mode: "edit", quote })}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    {/* Delete */}
                    <button
                      className="h-7 w-7 flex items-center justify-center hover:bg-black/10 transition-colors text-muted-foreground hover:text-red-600 disabled:opacity-50"
                      title="Delete quote"
                      disabled={deletingId === quote._id}
                      onClick={() => setDeleteTarget(quote)}
                    >
                      {deletingId === quote._id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
