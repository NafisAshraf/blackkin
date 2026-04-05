"use client";

import { useRef, useState } from "react";
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
import { Loader2, Pencil, Trash2, Upload, ToggleLeft, ToggleRight } from "lucide-react";

// ─── Image slot metadata ────────────────────────────────────────────────────
type ImageSlot =
  | "hero"
  | "lifestyleBanner"
  | "splitImage"
  | "tech1"
  | "tech2"
  | "tech3";

const IMAGE_SLOTS: { slot: ImageSlot; label: string; description: string }[] = [
  {
    slot: "hero",
    label: "Hero Banner",
    description: "Full-screen background image behind \"BE BOLD\"",
  },
  {
    slot: "lifestyleBanner",
    label: "Lifestyle Banner",
    description: "\"Upgrade The Way You Feel\" full-screen section background",
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
      // Reset file input so the same file can be re-selected
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
      <div>
        <h1 className="text-2xl font-semibold">Landing Page</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Manage homepage section images and testimonial quotes.
        </p>
      </div>

      {/* ── Images section ── */}
      <section className="space-y-4">
        <h2 className="text-base font-semibold border-b border-border pb-2">Section Images</h2>
        <p className="text-sm text-muted-foreground">
          Upload replacement images for each homepage section. Visitors will see the new image after refreshing the page.
        </p>

        {imageRows === undefined ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading images…
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {IMAGE_SLOTS.map(({ slot, label, description }) => {
              const currentUrl = imageMap[slot];
              const isUploading = uploading[slot] ?? false;

              return (
                <div
                  key={slot}
                  className="rounded-md border border-border overflow-hidden flex flex-col"
                >
                  {/* Image preview */}
                  <div className="bg-muted aspect-video relative flex items-center justify-center overflow-hidden">
                    {currentUrl ? (
                      <img
                        src={currentUrl}
                        alt={label}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="text-xs text-muted-foreground text-center px-4">
                        <Upload className="h-6 w-6 mx-auto mb-1 opacity-40" />
                        Using default image
                      </div>
                    )}
                    {isUploading && (
                      <div className="absolute inset-0 bg-background/70 flex items-center justify-center">
                        <Loader2 className="h-6 w-6 animate-spin" />
                      </div>
                    )}
                  </div>

                  {/* Slot info + upload button */}
                  <div className="p-3 flex flex-col gap-2 flex-1">
                    <div>
                      <p className="text-sm font-medium">{label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full mt-auto"
                      disabled={isUploading}
                      onClick={() => fileInputRefs.current[slot]?.click()}
                    >
                      {isUploading ? (
                        <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Uploading…</>
                      ) : (
                        <><Upload className="h-3.5 w-3.5 mr-1.5" /> {currentUrl ? "Replace Image" : "Upload Image"}</>
                      )}
                    </Button>
                    {/* Hidden file input */}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      ref={(el) => { fileInputRefs.current[slot] = el; }}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileChange(slot, file);
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Quotes section ── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-2">
          <h2 className="text-base font-semibold">Testimonial Quotes</h2>
          <Button size="sm" onClick={() => setQuoteDialog({ mode: "add" })}>
            Add Quote
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          These quotes appear in the homepage carousel. Toggle visibility to show or hide individual quotes.
        </p>

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
          <p className="text-sm text-muted-foreground py-4">
            No quotes yet. Add your first testimonial above.
          </p>
        ) : (
          <div className="rounded-md border divide-y">
            {quotes.map((quote) => (
              <div
                key={quote._id}
                className="flex items-start gap-3 px-4 py-3 bg-background"
              >
                <div className="flex-1 min-w-0 space-y-0.5">
                  <p className="text-sm line-clamp-2 text-foreground">{quote.text}</p>
                  <p className="text-xs text-muted-foreground">— {quote.author}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 pt-0.5">
                  <Badge variant={quote.isActive ? "default" : "secondary"} className="text-xs">
                    {quote.isActive ? "Visible" : "Hidden"}
                  </Badge>
                  {/* Toggle active */}
                  <button
                    className="h-7 w-7 flex items-center justify-center rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground disabled:opacity-50"
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
                    className="h-7 w-7 flex items-center justify-center rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                    title="Edit quote"
                    onClick={() => setQuoteDialog({ mode: "edit", quote })}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  {/* Delete */}
                  <button
                    className="h-7 w-7 flex items-center justify-center rounded hover:bg-muted transition-colors text-muted-foreground hover:text-red-600 disabled:opacity-50"
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
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
