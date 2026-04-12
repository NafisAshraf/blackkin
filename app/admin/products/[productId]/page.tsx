"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { useUploadFile } from "@convex-dev/r2/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, ArrowLeft, Upload, X, MoreHorizontal, Trash2, Box, Tag, Search } from "lucide-react";
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  VariantMatrix,
  matrixToVariants,
  variantsToMatrix,
  type StockMatrix,
} from "@/components/admin/VariantMatrix";
import {
  SortableImageGrid,
  type ImageMediaItem,
} from "@/components/admin/SortableImageGrid";

// ─── Types ────────────────────────────────────────────────────

type ProductStatus = "draft" | "active" | "scheduled" | "archived";
type SaleDisplayMode = "percentage" | "amount";

interface VideoMediaItem { storageId: string; previewUrl: string | null }
interface Model3DItem { storageId: string; fileName: string }

function slugify(str: string) {
  return str.toLowerCase().trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function toDatetimeLocal(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromDatetimeLocal(val: string): number {
  return new Date(val).getTime();
}

const STATUS_LABELS: Record<ProductStatus, string> = {
  draft: "Draft",
  active: "Active",
  scheduled: "Scheduled",
  archived: "Archived",
};

// ─── Character counter ────────────────────────────────────────

function CharCounter({ value, max, warn }: { value: string; max: number; warn: number }) {
  const len = value.length;
  const color = len > max ? "text-destructive" : len > warn ? "text-yellow-600" : "text-muted-foreground";
  return <span className={`text-xs ${color}`}>{len}/{max}</span>;
}

// ─── Discount display ─────────────────────────────────────────

function discountDisplay(basePrice: string, salePrice: string, mode: SaleDisplayMode): string | null {
  const base = Number(basePrice);
  const sale = Number(salePrice);
  if (!base || !sale || sale >= base) return null;
  if (mode === "percentage") {
    const pct = Math.round((1 - sale / base) * 100);
    return `${pct}% off`;
  }
  return `Tk ${(base - sale).toLocaleString("en-BD")} off`;
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

  // ── Mutations ─────────────────────────────────────────────────
  const updateProduct = useMutation(api.products.update);
  const updateVariants = useMutation(api.products.updateVariants);
  const assignTags = useMutation(api.products.assignTags);
  const removeProduct = useMutation(api.products.remove);
  const r2Upload = useUploadFile(api.r2);
  const r2Delete = useMutation(api.r2.deleteObject);

  // ── Form state ────────────────────────────────────────────────
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugManual, setSlugManual] = useState(false);
  const [debouncedSlug, setDebouncedSlug] = useState("");
  const [sku, setSku] = useState("");
  const [debouncedSku, setDebouncedSku] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [selectedTags, setSelectedTags] = useState<Set<Id<"tags">>>(new Set());
  const [videoItem, setVideoItem] = useState<VideoMediaItem | null>(null);
  const [model3dItem, setModel3dItem] = useState<Model3DItem | null>(null);
  const [images, setImages] = useState<ImageMediaItem[]>([]);
  const [existingVariantIds, setExistingVariantIds] = useState<Id<"productVariants">[]>([]);
  const [initialized, setInitialized] = useState(false);

  // ── Availability state ────────────────────────────────────────
  const [status, setStatus] = useState<ProductStatus>("draft");
  const [scheduledPublishTime, setScheduledPublishTime] = useState("");

  // ── Pricing state ─────────────────────────────────────────────
  const [basePrice, setBasePrice] = useState("");
  const [saleEnabled, setSaleEnabled] = useState(true);
  const [salePrice, setSalePrice] = useState("");
  const [saleDisplayMode, setSaleDisplayMode] = useState<SaleDisplayMode>("percentage");
  const [saleStartMode, setSaleStartMode] = useState<"immediately" | "custom">("immediately");
  const [saleStartTime, setSaleStartTime] = useState("");
  const [saleEndMode, setSaleEndMode] = useState<"indefinite" | "custom">("indefinite");
  const [saleEndTime, setSaleEndTime] = useState("");

  // ── SEO state ─────────────────────────────────────────────────
  const [metaTitle, setMetaTitle] = useState("");
  const [metaDescription, setMetaDescription] = useState("");

  // ── Variant Matrix state ──────────────────────────────────────
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [selectedSizes, setSelectedSizes] = useState<string[]>([]);
  const [stockMatrix, setStockMatrix] = useState<StockMatrix>({});

  // ── Other UI state ────────────────────────────────────────────
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [uploadingModel3d, setUploadingModel3d] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const videoInputRef = useRef<HTMLInputElement>(null);
  const model3dInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

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

  // ── SKU debounce + availability ───────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSku(sku), 400);
    return () => clearTimeout(t);
  }, [sku]);

  const skuAvailable = useQuery(
    api.products.checkSkuAvailable,
    debouncedSku.trim() ? { sku: debouncedSku, excludeId: productId } : "skip"
  );
  const skuTaken = debouncedSku.trim() && skuAvailable === false;

  // ── Populate form when product loads ──────────────────────────
  useEffect(() => {
    if (!product || initialized) return;

    setName(product.name);
    setSlug(product.slug);
    setSku((product as any).sku ?? "");
    setDescription(product.description);
    setCategoryId(product.categoryId ?? "");
    setBasePrice(product.basePrice.toString());
    setSelectedTags(new Set(product.tags.map((t) => t._id)));

    // Availability
    setStatus(product.status);
    if (product.scheduledPublishTime) {
      setScheduledPublishTime(toDatetimeLocal(product.scheduledPublishTime));
    }

    // Sale pricing
    setSaleEnabled(product.saleEnabled);
    if (product.salePrice !== undefined) setSalePrice(product.salePrice.toString());
    if ((product as any).saleDisplayMode) setSaleDisplayMode((product as any).saleDisplayMode);
    setSaleStartMode(product.saleStartMode);
    if (product.saleStartTime) setSaleStartTime(toDatetimeLocal(product.saleStartTime));
    setSaleEndMode(product.saleEndMode);
    if (product.saleEndTime) setSaleEndTime(toDatetimeLocal(product.saleEndTime));

    // SEO
    if ((product as any).metaTitle) setMetaTitle((product as any).metaTitle);
    if ((product as any).metaDescription) setMetaDescription((product as any).metaDescription);

    // Media
    const existingVideo = (product.media as any[]).find((m) => m.type === "video");
    const existingModel3d = (product.media as any[]).find((m) => m.type === "model3d");
    const existingImages = (product.media as any[])
      .filter((m) => m.type === "image")
      .sort((a: any, b: any) => a.sortOrder - b.sortOrder);

    setVideoItem(existingVideo ? { storageId: existingVideo.storageId, previewUrl: null } : null);
    setModel3dItem(existingModel3d ? { storageId: existingModel3d.storageId, fileName: "Existing 3D model" } : null);
    setImages(existingImages.map((m: any) => ({ storageId: m.storageId, previewUrl: null })));

    // Variants
    const rawVariants = (product.variants as any[]).map((v) => ({
      size: v.size as string,
      color: v.color as string | undefined,
      stock: (v.stock as number) ?? 0,
    }));
    const { selectedColors: cols, selectedSizes: szs, stockMatrix: mat } = variantsToMatrix(rawVariants);
    setExistingVariantIds((product.variants as any[]).map((v) => v._id as Id<"productVariants">));
    setSelectedColors(cols);
    setSelectedSizes(szs);
    setStockMatrix(mat);
    setInitialized(true);
  }, [product, initialized]);

  // ── Helpers ───────────────────────────────────────────────────

  function handleSaleStartTimeChange(val: string) {
    setSaleStartTime(val);
    if (val && !saleEndTime) {
      const ms = fromDatetimeLocal(val);
      setSaleEndTime(toDatetimeLocal(ms + 7 * 24 * 60 * 60 * 1000));
    }
  }

  async function handleVideoUpload(file: File) {
    if (!file.type.startsWith("video/")) { toast.error("Only video files are allowed"); return; }
    setUploadingVideo(true);
    try {
      const oldKey = videoItem?.storageId;
      const s = await r2Upload(file);
      if (oldKey) r2Delete({ key: oldKey }).catch(() => {});
      setVideoItem({ storageId: s, previewUrl: URL.createObjectURL(file) });
    }
    catch { toast.error("Upload failed"); } finally { setUploadingVideo(false); }
  }

  function handleRemoveVideo() {
    if (videoItem) {
      r2Delete({ key: videoItem.storageId }).catch(() => {});
      setVideoItem(null);
    }
  }

  async function handleModel3DUpload(file: File) {
    if (!file.name.toLowerCase().endsWith(".glb")) { toast.error("Only .glb files are supported"); return; }
    setUploadingModel3d(true);
    try {
      const oldKey = model3dItem?.storageId;
      const s = await r2Upload(file);
      if (oldKey) r2Delete({ key: oldKey }).catch(() => {});
      setModel3dItem({ storageId: s, fileName: file.name });
    }
    catch { toast.error("Upload failed"); } finally { setUploadingModel3d(false); }
  }

  function handleRemoveModel3D() {
    if (model3dItem) {
      r2Delete({ key: model3dItem.storageId }).catch(() => {});
      setModel3dItem(null);
    }
  }

  async function handleImageUpload(file: File) {
    if (!file.type.startsWith("image/")) { toast.error("Only image files are allowed"); return; }
    setUploadingImage(true);
    try { const s = await r2Upload(file); setImages((prev) => [...prev, { storageId: s, previewUrl: URL.createObjectURL(file) }]); }
    catch { toast.error("Upload failed"); } finally { setUploadingImage(false); }
  }

  const removeImage = useCallback(
    (storageId: string) => {
      setImages((prev) => prev.filter((img) => img.storageId !== storageId));
      r2Delete({ key: storageId }).catch(() => {});
    },
    [r2Delete]
  );

  // ── Save ──────────────────────────────────────────────────────
  async function handleSave() {
    if (!name || !categoryId || !basePrice) { toast.error("Name, category, and price are required"); return; }
    if (slugTaken) { toast.error("This slug is already in use"); return; }
    if (skuTaken) { toast.error("This SKU is already in use"); return; }
    if (saleEnabled && salePrice && Number(salePrice) >= Number(basePrice)) {
      toast.error("Sale price must be less than regular price"); return;
    }
    if (status === "scheduled" && !scheduledPublishTime) {
      toast.error("Set a publish date for scheduled status"); return;
    }

    setSaving(true);
    try {
      await updateProduct({
        id: productId,
        name,
        slug: slug.trim() || slugify(name),
        sku: sku.trim() || undefined,
        description,
        categoryId: categoryId as Id<"categories">,
        basePrice: parseFloat(basePrice),
        status,
        scheduledPublishTime: scheduledPublishTime ? fromDatetimeLocal(scheduledPublishTime) : undefined,
        saleEnabled,
        salePrice: saleEnabled && salePrice ? Number(salePrice) : undefined,
        saleDisplayMode: saleEnabled ? saleDisplayMode : undefined,
        saleStartMode: saleEnabled ? saleStartMode : "immediately",
        saleStartTime: saleEnabled && saleStartMode === "custom" && saleStartTime ? fromDatetimeLocal(saleStartTime) : undefined,
        saleEndMode: saleEnabled ? saleEndMode : "indefinite",
        saleEndTime: saleEnabled && saleEndMode === "custom" && saleEndTime ? fromDatetimeLocal(saleEndTime) : undefined,
        metaTitle: metaTitle.trim() || undefined,
        metaDescription: metaDescription.trim() || undefined,
        media: [
          ...(videoItem ? [{ storageId: videoItem.storageId, type: "video" as const, sortOrder: 0 }] : []),
          ...(model3dItem ? [{ storageId: model3dItem.storageId, type: "model3d" as const, sortOrder: 1 }] : []),
          ...images.map((img, i) => ({ storageId: img.storageId, type: "image" as const, sortOrder: 2 + i })),
        ],
      });

      const matrixVariants = matrixToVariants(stockMatrix, selectedColors, selectedSizes);
      await updateVariants({
        productId,
        variants: matrixVariants.map((v) => ({ size: v.size, color: v.color, stock: v.stock })),
        deleteIds: existingVariantIds,
      });
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
    return <div className="flex items-center justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  const hasNoConfig = (colors !== undefined && colors.length === 0) || (sizes !== undefined && sizes.length === 0);

  const statusVariant: Record<ProductStatus, "default" | "secondary" | "outline" | "destructive"> = {
    active: "default",
    draft: "secondary",
    scheduled: "outline",
    archived: "destructive",
  };

  const discountText = saleEnabled && salePrice
    ? discountDisplay(basePrice, salePrice, saleDisplayMode)
    : null;

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-1" />Back
          </Button>
          <div>
            <h1 className="text-xl font-semibold">Edit Product</h1>
            <p className="text-sm text-muted-foreground">{product.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={statusVariant[product.status]}>{STATUS_LABELS[product.status]}</Badge>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setShowDeleteDialog(true)}>
                <Trash2 className="mr-2 h-4 w-4" />Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Delete confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Product?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete the product and all its variants. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting}>
              {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 2-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 items-start">

        {/* ── Left column ── */}
        <div className="space-y-6">

          {/* Basic Info */}
          <Card>
            <CardHeader><CardTitle className="text-base">Basic Info</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input id="name" value={name} onChange={(e) => { setName(e.target.value); if (!slugManual) setSlug(slugify(e.target.value)); }} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="slug">Slug</Label>
                  <Input id="slug" value={slug} onChange={(e) => { setSlug(e.target.value); setSlugManual(true); }} className={slugTaken ? "border-destructive" : ""} />
                  {slugTaken && <p className="text-xs text-destructive">This slug is already in use</p>}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="sku">SKU</Label>
                <Input
                  id="sku"
                  value={sku}
                  onChange={(e) => setSku(e.target.value.toUpperCase())}
                  placeholder="e.g. BLK-A7X2M1"
                  className={`max-w-xs ${skuTaken ? "border-destructive" : ""}`}
                />
                {skuTaken
                  ? <p className="text-xs text-destructive">This SKU is already in use</p>
                  : <p className="text-xs text-muted-foreground">Unique product identifier</p>
                }
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent>
                    {(categories ?? []).map((c) => <SelectItem key={c._id} value={c._id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
            </CardContent>
          </Card>

          {/* Variants & Stock */}
          <Card>
            <CardHeader><CardTitle className="text-base">Variants & Stock</CardTitle></CardHeader>
            <CardContent>
              {initialized ? (
                <VariantMatrix
                  platformSizes={sizes} platformColors={colors}
                  selectedColors={selectedColors} onSelectedColorsChange={setSelectedColors}
                  selectedSizes={selectedSizes} onSelectedSizesChange={setSelectedSizes}
                  stockMatrix={stockMatrix} onStockMatrixChange={setStockMatrix}
                />
              ) : <p className="text-sm text-muted-foreground">Loading variants…</p>}
            </CardContent>
          </Card>

          {/* Images */}
          <Card>
            <CardHeader><CardTitle className="text-base">Images <span className="text-sm font-normal text-muted-foreground">(optional, multiple — drag to reorder)</span></CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <input ref={imageInputRef} type="file" accept="image/*" className="hidden"
                onChange={async (e) => { const f = e.target.files?.[0]; if (f) await handleImageUpload(f); e.target.value = ""; }} />
              <Button type="button" variant="outline" size="sm" disabled={uploadingImage} onClick={() => imageInputRef.current?.click()}>
                {uploadingImage ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Uploading…</> : <><Upload className="mr-2 h-4 w-4" />Upload Image</>}
              </Button>
              {images.length > 0 && (
                <SortableImageGrid images={images} onReorder={setImages} onRemove={removeImage} />
              )}
            </CardContent>
          </Card>

          {/* Video */}
          <Card>
            <CardHeader><CardTitle className="text-base">Video <span className="text-sm font-normal text-muted-foreground">(optional)</span></CardTitle></CardHeader>
            <CardContent>
              <input ref={videoInputRef} type="file" accept="video/*" className="hidden"
                onChange={async (e) => { const f = e.target.files?.[0]; if (f) await handleVideoUpload(f); e.target.value = ""; }} />
              {videoItem ? (
                <div className="relative group w-48 h-28 rounded-md overflow-hidden border bg-muted">
                  {videoItem.previewUrl ? <video src={videoItem.previewUrl} className="w-full h-full object-cover" muted />
                    : <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">video</div>}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Button type="button" variant="destructive" size="icon" className="h-7 w-7" onClick={handleRemoveVideo}><X className="h-3 w-3" /></Button>
                  </div>
                </div>
              ) : (
                <Button type="button" variant="outline" size="sm" disabled={uploadingVideo} onClick={() => videoInputRef.current?.click()}>
                  {uploadingVideo ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Uploading…</> : <><Upload className="mr-2 h-4 w-4" />Upload Video</>}
                </Button>
              )}
            </CardContent>
          </Card>

          {/* 3D Model */}
          <Card>
            <CardHeader><CardTitle className="text-base">3D Model <span className="text-sm font-normal text-muted-foreground">(optional — GLB)</span></CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <input ref={model3dInputRef} type="file" accept=".glb" className="hidden"
                onChange={async (e) => { const f = e.target.files?.[0]; if (f) await handleModel3DUpload(f); e.target.value = ""; }} />
              {model3dItem ? (
                <div className="flex items-center gap-3 p-3 rounded-md border bg-muted">
                  <Box className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  <span className="text-sm truncate flex-1">{model3dItem.fileName}</span>
                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={handleRemoveModel3D}><X className="h-3 w-3" /></Button>
                </div>
              ) : (
                <>
                  <Button type="button" variant="outline" size="sm" disabled={uploadingModel3d} onClick={() => model3dInputRef.current?.click()}>
                    {uploadingModel3d ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Uploading…</> : <><Upload className="mr-2 h-4 w-4" />Upload 3D Model</>}
                  </Button>
                  <p className="text-xs text-muted-foreground">Only .glb files are supported</p>
                </>
              )}
            </CardContent>
          </Card>

        </div>

        {/* ── Right column (sidebar) ── */}
        <div className="space-y-6">

          {/* Availability */}
          <Card>
            <CardHeader><CardTitle className="text-base">Availability</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as ProductStatus)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft — hidden from customers</SelectItem>
                    <SelectItem value="active">Active — visible and purchasable</SelectItem>
                    <SelectItem value="scheduled">Scheduled — goes live at a set date</SelectItem>
                    <SelectItem value="archived">Archived — retired product</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {status === "scheduled" && (
                <div className="space-y-2">
                  <Label htmlFor="scheduledPublishTime">Publish date & time</Label>
                  <Input id="scheduledPublishTime" type="datetime-local" value={scheduledPublishTime} onChange={(e) => setScheduledPublishTime(e.target.value)} />
                  <p className="text-xs text-muted-foreground">Product becomes visible to customers at this time automatically.</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pricing */}
          <Card>
            <CardHeader><CardTitle className="text-base">Pricing</CardTitle></CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="basePrice">Regular Price (৳)</Label>
                <Input id="basePrice" type="number" min="0" value={basePrice} onChange={(e) => setBasePrice(e.target.value)} />
              </div>

              <div className="flex items-center gap-3">
                <Switch id="saleToggle" checked={saleEnabled} onCheckedChange={setSaleEnabled} />
                <Label htmlFor="saleToggle" className="cursor-pointer font-medium">Enable Sale Pricing</Label>
              </div>

              {saleEnabled && (
                <div className="space-y-5 border-l-2 border-muted pl-4">
                  <div className="space-y-2">
                    <Label htmlFor="salePrice">Sale Price (৳)</Label>
                    <Input id="salePrice" type="number" min="0" step="1" value={salePrice} onChange={(e) => setSalePrice(e.target.value)} />
                  </div>

                  {/* Discount display mode */}
                  <div className="space-y-2">
                    <Label className="text-sm">Show Discount As</Label>
                    <RadioGroup
                      value={saleDisplayMode}
                      onValueChange={(v) => setSaleDisplayMode(v as SaleDisplayMode)}
                      className="flex gap-4"
                    >
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="percentage" id="edit-mode-pct" />
                        <Label htmlFor="edit-mode-pct" className="cursor-pointer font-normal text-sm">Percentage</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="amount" id="edit-mode-amt" />
                        <Label htmlFor="edit-mode-amt" className="cursor-pointer font-normal text-sm">Fixed Amount</Label>
                      </div>
                    </RadioGroup>
                    {discountText && (
                      <p className="text-sm font-medium text-green-600">Discount: {discountText}</p>
                    )}
                  </div>

                  <div className="space-y-4">
                    <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Discount Schedule</p>
                    <div className="space-y-2">
                      <Label className="text-sm">Starts</Label>
                      <RadioGroup value={saleStartMode} onValueChange={(v) => setSaleStartMode(v as "immediately" | "custom")} className="gap-2">
                        <div className="flex items-center gap-2">
                          <RadioGroupItem value="immediately" id="edit-start-immediately" />
                          <Label htmlFor="edit-start-immediately" className="cursor-pointer font-normal">Immediately</Label>
                        </div>
                        <div className="flex items-center gap-2">
                          <RadioGroupItem value="custom" id="edit-start-custom" />
                          <Label htmlFor="edit-start-custom" className="cursor-pointer font-normal">Custom date & time</Label>
                        </div>
                      </RadioGroup>
                      {saleStartMode === "custom" && (
                        <Input type="datetime-local" value={saleStartTime} onChange={(e) => handleSaleStartTimeChange(e.target.value)} className="mt-2" />
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm">Ends</Label>
                      <RadioGroup value={saleEndMode} onValueChange={(v) => setSaleEndMode(v as "indefinite" | "custom")} className="gap-2">
                        <div className="flex items-center gap-2">
                          <RadioGroupItem value="indefinite" id="edit-end-indefinite" />
                          <Label htmlFor="edit-end-indefinite" className="cursor-pointer font-normal">Indefinite</Label>
                        </div>
                        <div className="flex items-center gap-2">
                          <RadioGroupItem value="custom" id="edit-end-custom" />
                          <Label htmlFor="edit-end-custom" className="cursor-pointer font-normal">Custom date & time</Label>
                        </div>
                      </RadioGroup>
                      {saleEndMode === "custom" && (
                        <Input type="datetime-local" value={saleEndTime} onChange={(e) => setSaleEndTime(e.target.value)} className="mt-2" />
                      )}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tags */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Tag className="h-4 w-4" />
                <CardTitle className="text-base">Tags</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {!tags ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                : tags.length === 0 ? <p className="text-sm text-muted-foreground">No tags available.</p>
                : (
                  <div className="grid grid-cols-2 gap-3">
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
                        <Label htmlFor={`tag-${tag._id}`} className="cursor-pointer font-normal text-sm">{tag.name}</Label>
                      </div>
                    ))}
                  </div>
                )}
            </CardContent>
          </Card>

          {/* SEO */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4" />
                <CardTitle className="text-base">SEO</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-muted-foreground">These fields appear in search engine results. Leave blank to use product name and description.</p>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="metaTitle">Meta Title</Label>
                  <CharCounter value={metaTitle} max={60} warn={50} />
                </div>
                <Input
                  id="metaTitle"
                  value={metaTitle}
                  onChange={(e) => setMetaTitle(e.target.value)}
                  placeholder={name || "Product name"}
                  maxLength={80}
                />
                <p className="text-xs text-muted-foreground">Recommended: under 60 characters</p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="metaDescription">Meta Description</Label>
                  <CharCounter value={metaDescription} max={160} warn={140} />
                </div>
                <Textarea
                  id="metaDescription"
                  value={metaDescription}
                  onChange={(e) => setMetaDescription(e.target.value)}
                  placeholder={description || "Product description"}
                  rows={3}
                  maxLength={200}
                />
                <p className="text-xs text-muted-foreground">Recommended: under 160 characters</p>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <Button onClick={handleSave} disabled={saving || !!slugTaken || !!skuTaken || hasNoConfig} className="flex-1">
              {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving…</> : "Save Changes"}
            </Button>
            <Button variant="outline" onClick={() => router.back()}>Cancel</Button>
          </div>

        </div>
      </div>
    </div>
  );
}
