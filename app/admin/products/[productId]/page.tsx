"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, ArrowLeft, ArrowUp, ArrowDown, Upload, X, MoreHorizontal, Pencil, Trash2, ToggleLeft, ToggleRight } from "lucide-react";
import Link from "next/link";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  VariantMatrix,
  matrixToVariants,
  variantsToMatrix,
  type StockMatrix,
} from "@/components/admin/VariantMatrix";

// ─── Types ────────────────────────────────────────────────────

interface MediaItem {
  storageId: Id<"_storage">;
  previewUrl: string | null; // null for server-stored items without URL yet
  type: "image" | "video";
}

function slugify(str: string) {
  return str.toLowerCase().trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// ─── Component ────────────────────────────────────────────────

export default function EditProductPage() {
  const params = useParams();
  const router = useRouter();
  const productId = params.productId as Id<"products">;

  // ── Queries ──────────────────────────────────────────────────
  const product = useQuery(api.products.getById, { id: productId });
  const categories = useQuery(api.categories.listAll);
  const tags = useQuery(api.tags.list);
  const sizes = useQuery(api.platformConfig.listSizes);
  const colors = useQuery(api.platformConfig.listColors);

  // Featured state from recommendations table (no optimistic updates)
  const isBestSeller = useQuery(api.recommendations.isProductInSection, {
    type: "best_sellers",
    productId,
  });
  const isNewArrival = useQuery(api.recommendations.isProductInSection, {
    type: "new_arrivals",
    productId,
  });

  // ── Mutations ─────────────────────────────────────────────────
  const updateProduct = useMutation(api.products.update);
  const updateVariants = useMutation(api.products.updateVariants);
  const assignTags = useMutation(api.products.assignTags);
  const toggleActive = useMutation(api.products.toggleActive);
  const removeProduct = useMutation(api.products.remove);
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const addAtTop = useMutation(api.recommendations.addAtTop);
  const removeByProductAndType = useMutation(api.recommendations.removeByProductAndType);

  // ── Form state ────────────────────────────────────────────────
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugManual, setSlugManual] = useState(false);
  const [debouncedSlug, setDebouncedSlug] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [basePrice, setBasePrice] = useState("");
  const [selectedTags, setSelectedTags] = useState<Set<Id<"tags">>>(new Set());
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [existingVariantIds, setExistingVariantIds] = useState<Id<"productVariants">[]>([]);
  const [initialized, setInitialized] = useState(false);

  // ── Variant Matrix state ──────────────────────────────────────
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [selectedSizes, setSelectedSizes] = useState<string[]>([]);
  const [stockMatrix, setStockMatrix] = useState<StockMatrix>({});

  // ── Featured loading ─────────────────────────────────────────
  const [togglingBestSeller, setTogglingBestSeller] = useState(false);
  const [togglingNewArrival, setTogglingNewArrival] = useState(false);

  // ── Other UI state ────────────────────────────────────────────
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Slug debounce ─────────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSlug(slug), 400);
    return () => clearTimeout(t);
  }, [slug]);

  const slugAvailable = useQuery(
    api.products.checkSlugAvailable,
    debouncedSlug.trim() ? { slug: debouncedSlug, excludeId: productId } : "skip"
  );
  const slugTaken = debouncedSlug.trim() && slugAvailable === false;

  // ── Populate form when product loads (once) ───────────────────
  useEffect(() => {
    if (!product || initialized) return;

    setName(product.name);
    setSlug(product.slug);
    setDescription(product.description);
    setCategoryId(product.categoryId);
    setBasePrice(product.basePrice.toString());
    setSelectedTags(new Set(product.tags.map((t) => t._id)));
    setMedia(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (product.media as any[]).map((m) => ({
        storageId: m.storageId,
        previewUrl: null, // existing media — no local URL
        type: m.type as "image" | "video",
      }))
    );

    // Pre-populate variant matrix from existing variants
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawVariants = (product.variants as any[]).map((v) => ({
      size: v.size as string,
      color: v.color as string | undefined,
      stock: (v.stock as number) ?? 0,
    }));
    const { selectedColors: cols, selectedSizes: szs, stockMatrix: mat } =
      variantsToMatrix(rawVariants);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setExistingVariantIds((product.variants as any[]).map((v) => v._id as Id<"productVariants">));
    setSelectedColors(cols);
    setSelectedSizes(szs);
    setStockMatrix(mat);
    setInitialized(true);
  }, [product, initialized]);

  // ── File upload ───────────────────────────────────────────────
  async function handleFileUpload(file: File) {
    if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
      toast.error("Only image and video files are allowed");
      return;
    }
    setUploading(true);
    try {
      const uploadUrl = await generateUploadUrl({});
      const result = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!result.ok) throw new Error("Upload failed");
      const { storageId } = await result.json();
      const previewUrl = URL.createObjectURL(file);
      const type: "image" | "video" = file.type.startsWith("video/") ? "video" : "image";
      setMedia((prev) => [...prev, { storageId, previewUrl, type }]);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  function removeMedia(index: number) {
    setMedia((prev) => prev.filter((_, i) => i !== index));
  }

  function moveMedia(index: number, direction: "up" | "down") {
    setMedia((prev) => {
      const next = [...prev];
      const swap = direction === "up" ? index - 1 : index + 1;
      if (swap < 0 || swap >= next.length) return prev;
      [next[index], next[swap]] = [next[swap], next[index]];
      return next;
    });
  }

  // ── Featured toggles ──────────────────────────────────────────
  async function toggleBestSeller() {
    if (isBestSeller === undefined || togglingBestSeller) return;
    setTogglingBestSeller(true);
    try {
      if (isBestSeller) {
        await removeByProductAndType({ type: "best_sellers", recommendedProductId: productId });
        toast.success("Removed from Best Sellers");
      } else {
        await addAtTop({ type: "best_sellers", recommendedProductId: productId });
        toast.success("Added to Best Sellers");
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to update");
    } finally {
      setTogglingBestSeller(false);
    }
  }

  async function toggleNewArrival() {
    if (isNewArrival === undefined || togglingNewArrival) return;
    setTogglingNewArrival(true);
    try {
      if (isNewArrival) {
        await removeByProductAndType({ type: "new_arrivals", recommendedProductId: productId });
        toast.success("Removed from New Arrivals");
      } else {
        await addAtTop({ type: "new_arrivals", recommendedProductId: productId });
        toast.success("Added to New Arrivals");
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to update");
    } finally {
      setTogglingNewArrival(false);
    }
  }

  // ── Save ──────────────────────────────────────────────────────
  async function handleSave() {
    if (!name || !categoryId || !basePrice) {
      toast.error("Name, category, and price are required");
      return;
    }
    if (slugTaken) {
      toast.error("This slug is already in use");
      return;
    }

    setSaving(true);
    try {
      await updateProduct({
        id: productId,
        name,
        slug: slug.trim() || slugify(name),
        description,
        categoryId: categoryId as Id<"categories">,
        basePrice: parseFloat(basePrice),
        media: media.map((m, i) => ({ storageId: m.storageId, type: m.type, sortOrder: i })),
      });

      // Delete all existing variants and re-create from matrix
      const matrixVariants = matrixToVariants(stockMatrix, selectedColors, selectedSizes);
      await updateVariants({
        productId,
        variants: matrixVariants.map((v) => ({ size: v.size, color: v.color, stock: v.stock })),
        deleteIds: existingVariantIds,
      });
      // After save, new variant IDs are unknown — clear so we don't double-delete
      setExistingVariantIds([]);

      await assignTags({ productId, tagIds: Array.from(selectedTags) });
      toast.success("Product updated");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to update");
    } finally {
      setSaving(false);
    }
  }

  // ── Delete ────────────────────────────────────────────────────
  async function handleDelete() {
    setDeleting(true);
    try {
      await removeProduct({ id: productId });
      toast.success("Product deleted");
      router.push("/admin/products");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to delete");
      setDeleting(false);
    }
  }

  // ── Loading state ─────────────────────────────────────────────
  if (!product) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const hasNoConfig =
    (colors !== undefined && colors.length === 0) ||
    (sizes !== undefined && sizes.length === 0);

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/admin/products">
              <ArrowLeft className="h-4 w-4 mr-1" />Back
            </Link>
          </Button>
          <div>
            <h1 className="text-xl font-semibold">Edit Product</h1>
            <p className="text-sm text-muted-foreground">{product.name}</p>
          </div>
        </div>

        {/* 3-dot menu for Deactivate / Delete */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() =>
                toggleActive({ id: productId, isActive: !product.isActive })
                  .then(() => toast.success(product.isActive ? "Deactivated" : "Activated"))
                  .catch((e) => toast.error(e.message))
              }
            >
              {product.isActive ? (
                <><ToggleLeft className="mr-2 h-4 w-4" />Deactivate</>
              ) : (
                <><ToggleRight className="mr-2 h-4 w-4" />Activate</>
              )}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => setShowDeleteDialog(true)}
            >
              <Trash2 className="mr-2 h-4 w-4" />Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Delete confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Product?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the product and all its variants. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting}>
              {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Status badges */}
      <div className="flex gap-2 flex-wrap">
        <Badge variant={product.isActive ? "default" : "secondary"}>
          {product.isActive ? "Active" : "Inactive"}
        </Badge>
        {isBestSeller && <Badge variant="default">Best Seller</Badge>}
        {isNewArrival && <Badge variant="default">New Arrival</Badge>}
      </div>

      {/* ── 1. Basic Info ── */}
      <Card>
        <CardHeader><CardTitle className="text-base">Basic Info</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (!slugManual) setSlug(slugify(e.target.value));
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="slug">Slug</Label>
              <Input
                id="slug"
                value={slug}
                onChange={(e) => { setSlug(e.target.value); setSlugManual(true); }}
                className={slugTaken ? "border-destructive" : ""}
              />
              {slugTaken && (
                <p className="text-xs text-destructive">This slug is already in use</p>
              )}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  {(categories ?? []).map((c) => (
                    <SelectItem key={c._id} value={c._id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="basePrice">Base Price (৳)</Label>
              <Input
                id="basePrice"
                type="number"
                min="0"
                value={basePrice}
                onChange={(e) => setBasePrice(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* ── 2. Variants ── */}
      <Card>
        <CardHeader><CardTitle className="text-base">Variants &amp; Stock</CardTitle></CardHeader>
        <CardContent>
          {initialized ? (
            <VariantMatrix
              platformSizes={sizes}
              platformColors={colors}
              selectedColors={selectedColors}
              onSelectedColorsChange={setSelectedColors}
              selectedSizes={selectedSizes}
              onSelectedSizesChange={setSelectedSizes}
              stockMatrix={stockMatrix}
              onStockMatrixChange={setStockMatrix}
            />
          ) : (
            <p className="text-sm text-muted-foreground">Loading variants…</p>
          )}
        </CardContent>
      </Card>

      {/* ── 3. Media ── */}
      <Card>
        <CardHeader><CardTitle className="text-base">Media</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (file) await handleFileUpload(file);
              e.target.value = "";
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Uploading…</>
            ) : (
              <><Upload className="mr-2 h-4 w-4" />Upload Image / Video</>
            )}
          </Button>

          {media.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {media.map((item, i) => (
                <div key={item.storageId} className="relative group rounded-md overflow-hidden border bg-muted">
                  {item.previewUrl ? (
                    item.type === "image" ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.previewUrl} alt={`media-${i}`} className="w-full h-28 object-cover" />
                    ) : (
                      <video src={item.previewUrl} className="w-full h-28 object-cover" muted />
                    )
                  ) : (
                    <div className="w-full h-28 flex items-center justify-center text-xs text-muted-foreground">
                      {item.type}
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                    <Button type="button" variant="secondary" size="icon" className="h-7 w-7" disabled={i === 0} onClick={() => moveMedia(i, "up")}>
                      <ArrowUp className="h-3 w-3" />
                    </Button>
                    <Button type="button" variant="secondary" size="icon" className="h-7 w-7" disabled={i === media.length - 1} onClick={() => moveMedia(i, "down")}>
                      <ArrowDown className="h-3 w-3" />
                    </Button>
                    <Button type="button" variant="destructive" size="icon" className="h-7 w-7" onClick={() => removeMedia(i)}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                  {i === 0 && (
                    <span className="absolute top-1 left-1 text-[10px] bg-black/70 text-white px-1 rounded">Cover</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── 4. Tags ── */}
      <Card>
        <CardHeader><CardTitle className="text-base">Tags</CardTitle></CardHeader>
        <CardContent>
          {!tags ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : tags.length === 0 ? (
            <p className="text-sm text-muted-foreground">No tags available.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {tags.map((tag) => (
                <div key={tag._id} className="flex items-center gap-2">
                  <Checkbox
                    id={`tag-${tag._id}`}
                    checked={selectedTags.has(tag._id)}
                    onCheckedChange={(checked) => {
                      setSelectedTags((prev) => {
                        const next = new Set(prev);
                        checked ? next.add(tag._id) : next.delete(tag._id);
                        return next;
                      });
                    }}
                  />
                  <Label htmlFor={`tag-${tag._id}`} className="cursor-pointer font-normal text-sm">
                    {tag.name}
                  </Label>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── 5. Featured ── */}
      <Card>
        <CardHeader><CardTitle className="text-base">Featured</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Toggle to add or remove this product from homepage featured sections.
          </p>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="bestSeller" className="font-normal cursor-pointer">Best Seller</Label>
              <div className="flex items-center gap-2">
                {togglingBestSeller && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                <Switch
                  id="bestSeller"
                  checked={isBestSeller ?? false}
                  disabled={isBestSeller === undefined || togglingBestSeller}
                  onCheckedChange={toggleBestSeller}
                />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="newArrival" className="font-normal cursor-pointer">New Arrival</Label>
              <div className="flex items-center gap-2">
                {togglingNewArrival && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                <Switch
                  id="newArrival"
                  checked={isNewArrival ?? false}
                  disabled={isNewArrival === undefined || togglingNewArrival}
                  onCheckedChange={toggleNewArrival}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Actions ── */}
      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={saving || !!slugTaken || hasNoConfig}>
          {saving ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving…</>
          ) : (
            "Save Changes"
          )}
        </Button>
        <Button variant="outline" asChild>
          <Link href="/admin/products">Cancel</Link>
        </Button>
      </div>
    </div>
  );
}
