"use client";

import { useState, useRef, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { useUploadFile } from "@convex-dev/r2/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { toast } from "sonner";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ArrowLeft, Loader2, Upload, X, Box, Tag, Search } from "lucide-react";
import {
  VariantMatrix,
  matrixToVariants,
  type StockMatrix,
} from "@/components/admin/VariantMatrix";
import {
  SortableImageGrid,
  type ImageMediaItem,
} from "@/components/admin/SortableImageGrid";

// ─── Types ────────────────────────────────────────────────────────────────────

type ProductStatus = "draft" | "active" | "scheduled" | "archived";
type SaleDisplayMode = "percentage" | "amount";

interface VideoMediaItem { storageId: string; previewUrl: string | null }
interface Model3DItem { storageId: string; fileName: string }

const SKU_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

function skuPrefix(name: string): string {
  const letters = name.toUpperCase().replace(/[^A-Z]/g, "");
  return (letters + "XXX").slice(0, 3);
}

function randomSkuSuffix(): string {
  let s = "";
  for (let i = 0; i < 6; i++) s += SKU_CHARS[Math.floor(Math.random() * SKU_CHARS.length)];
  return s;
}

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

// ─── Character counter helper ─────────────────────────────────────────────────

function CharCounter({ value, max, warn }: { value: string; max: number; warn: number }) {
  const len = value.length;
  const color = len > max ? "text-destructive" : len > warn ? "text-yellow-600" : "text-muted-foreground";
  return <span className={`text-xs ${color}`}>{len}/{max}</span>;
}

// ─── Discount display helper ───────────────────────────────────────────────────

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

// ─── Inner component (uses useSearchParams) ───────────────────────────────────

function NewProductForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const from = searchParams.get("from") ?? "all";
  const backHref = `/admin/products?tab=${from}`;

  // Queries
  const categories = useQuery(api.categories.listAll);
  const sizes = useQuery(api.platformConfig.listSizes);
  const colors = useQuery(api.platformConfig.listColors);
  const tags = useQuery(api.tags.list);

  // Mutations
  const createProduct = useMutation(api.products.create);
  const assignTags = useMutation(api.products.assignTags);
  const addToDiscountGroup = useMutation(api.discountGroups.addProducts);
  const r2Upload = useUploadFile(api.r2);
  const r2Delete = useMutation(api.r2.deleteObject);

  // ── URL param preselection ─────────────────────────────────
  const preselectedCategoryId = searchParams.get("categoryId") ?? "";
  const preselectedTagId = searchParams.get("tagId") ?? "";
  const preselectedGroupId = searchParams.get("discountGroupId") ?? "";

  // ── Basic Info ──────────────────────────────────────────────
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugManual, setSlugManual] = useState(false);
  const [debouncedSlug, setDebouncedSlug] = useState("");
  const [sku, setSku] = useState("");
  const [skuManual, setSkuManual] = useState(false);
  const [debouncedSku, setDebouncedSku] = useState("");
  const skuSuffixRef = useRef(randomSkuSuffix());
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState<string>(preselectedCategoryId);

  // ── Availability ────────────────────────────────────────────
  const [status, setStatus] = useState<ProductStatus>("draft");
  const [scheduledPublishTime, setScheduledPublishTime] = useState("");

  // ── Pricing ─────────────────────────────────────────────────
  const [basePrice, setBasePrice] = useState("");
  const [saleEnabled, setSaleEnabled] = useState(true);
  const [salePrice, setSalePrice] = useState("");
  const [saleDisplayMode, setSaleDisplayMode] = useState<SaleDisplayMode>("percentage");
  const [saleStartMode, setSaleStartMode] = useState<"immediately" | "custom">("immediately");
  const [saleStartTime, setSaleStartTime] = useState("");
  const [saleEndMode, setSaleEndMode] = useState<"indefinite" | "custom">("indefinite");
  const [saleEndTime, setSaleEndTime] = useState("");

  // ── SEO ──────────────────────────────────────────────────────
  const [metaTitle, setMetaTitle] = useState("");
  const [metaDescription, setMetaDescription] = useState("");

  // ── Slug debounce ───────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSlug(slug), 400);
    return () => clearTimeout(t);
  }, [slug]);

  const slugAvailable = useQuery(
    api.products.checkSlugAvailable,
    debouncedSlug.trim() ? { slug: debouncedSlug } : "skip"
  );
  const slugTaken = debouncedSlug.trim() && slugAvailable === false;

  // ── SKU debounce ────────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSku(sku), 400);
    return () => clearTimeout(t);
  }, [sku]);

  const skuAvailable = useQuery(
    api.products.checkSkuAvailable,
    debouncedSku.trim() ? { sku: debouncedSku } : "skip"
  );
  const skuTaken = debouncedSku.trim() && skuAvailable === false;

  // ── Variant Matrix ──────────────────────────────────────────
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [selectedSizes, setSelectedSizes] = useState<string[]>([]);
  const [stockMatrix, setStockMatrix] = useState<StockMatrix>({});

  useEffect(() => {
    if (colors && colors.length > 0 && selectedColors.length === 0) {
      const first = colors[0].name;
      setSelectedColors([first]);
      setStockMatrix((prev) => ({ ...prev, [first]: {} }));
    }
  }, [colors]);

  useEffect(() => {
    if (sizes && sizes.length > 0 && selectedSizes.length === 0) {
      setSelectedSizes([sizes[0].name]);
    }
  }, [sizes]);

  // ── Media ───────────────────────────────────────────────────
  const [videoItem, setVideoItem] = useState<VideoMediaItem | null>(null);
  const [model3dItem, setModel3dItem] = useState<Model3DItem | null>(null);
  const [images, setImages] = useState<ImageMediaItem[]>([]);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [uploadingModel3d, setUploadingModel3d] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const model3dInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // ── Tags ─────────────────────────────────────────────────────
  const [selectedTagIds, setSelectedTagIds] = useState<Set<Id<"tags">>>(new Set());

  useEffect(() => {
    if (preselectedTagId && tags) {
      const tag = tags.find((t) => t._id === preselectedTagId);
      if (tag) setSelectedTagIds(new Set([tag._id as Id<"tags">]));
    }
  }, [tags, preselectedTagId]);

  // ── Submitting ───────────────────────────────────────────────
  const [submitting, setSubmitting] = useState(false);

  // ── Helpers ──────────────────────────────────────────────────

  function handleNameChange(val: string) {
    setName(val);
    if (!slugManual) setSlug(slugify(val));
    if (!skuManual) setSku(val.trim() ? `${skuPrefix(val)}-${skuSuffixRef.current}` : "");
  }

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
      const storageId = await r2Upload(file);
      if (oldKey) r2Delete({ key: oldKey }).catch(() => {});
      setVideoItem({ storageId, previewUrl: URL.createObjectURL(file) });
    } catch { toast.error("Upload failed"); } finally { setUploadingVideo(false); }
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
      const storageId = await r2Upload(file);
      if (oldKey) r2Delete({ key: oldKey }).catch(() => {});
      setModel3dItem({ storageId, fileName: file.name });
    } catch { toast.error("Upload failed"); } finally { setUploadingModel3d(false); }
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
    try {
      const storageId = await r2Upload(file);
      setImages((prev) => [...prev, { storageId, previewUrl: URL.createObjectURL(file) }]);
    } catch { toast.error("Upload failed"); } finally { setUploadingImage(false); }
  }

  const removeImage = useCallback(
    (storageId: string) => {
      setImages((prev) => prev.filter((img) => img.storageId !== storageId));
      r2Delete({ key: storageId }).catch(() => {});
    },
    [r2Delete]
  );

  function toggleTag(tagId: Id<"tags">) {
    setSelectedTagIds((prev) => {
      const next = new Set(prev);
      if (next.has(tagId)) next.delete(tagId); else next.add(tagId);
      return next;
    });
  }

  const hasNoConfig = (colors !== undefined && colors.length === 0) ||
    (sizes !== undefined && sizes.length === 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!categoryId) { toast.error("Please select a category"); return; }
    if (!basePrice || isNaN(Number(basePrice)) || Number(basePrice) <= 0) {
      toast.error("Enter a valid regular price"); return;
    }
    if (slugTaken) { toast.error("This slug is already in use"); return; }
    if (skuTaken) { toast.error("This SKU is already in use"); return; }
    if (hasNoConfig) { toast.error("Configure colors and sizes first in Platform Configuration"); return; }
    if (selectedColors.length === 0 || selectedSizes.length === 0) {
      toast.error("Select at least one color and one size"); return;
    }
    if (saleEnabled && salePrice && Number(salePrice) >= Number(basePrice)) {
      toast.error("Sale price must be less than regular price"); return;
    }
    if (status === "scheduled" && !scheduledPublishTime) {
      toast.error("Set a publish date for scheduled status"); return;
    }

    setSubmitting(true);
    try {
      const variants = matrixToVariants(stockMatrix, selectedColors, selectedSizes);

      const productId = await createProduct({
        name: name.trim(),
        slug: slug.trim() || slugify(name),
        sku: sku.trim() || undefined,
        description: description.trim(),
        categoryId: categoryId as Id<"categories">,
        basePrice: Number(basePrice),
        status,
        scheduledPublishTime: scheduledPublishTime ? fromDatetimeLocal(scheduledPublishTime) : undefined,
        saleEnabled,
        salePrice: saleEnabled && salePrice ? Number(salePrice) : undefined,
        saleDisplayMode: saleEnabled ? saleDisplayMode : undefined,
        saleStartMode: saleEnabled ? saleStartMode : "immediately",
        saleStartTime: saleEnabled && saleStartMode === "custom" && saleStartTime
          ? fromDatetimeLocal(saleStartTime) : undefined,
        saleEndMode: saleEnabled ? saleEndMode : "indefinite",
        saleEndTime: saleEnabled && saleEndMode === "custom" && saleEndTime
          ? fromDatetimeLocal(saleEndTime) : undefined,
        metaTitle: metaTitle.trim() || undefined,
        metaDescription: metaDescription.trim() || undefined,
        media: [
          ...(videoItem ? [{ storageId: videoItem.storageId, type: "video" as const, sortOrder: 0 }] : []),
          ...(model3dItem ? [{ storageId: model3dItem.storageId, type: "model3d" as const, sortOrder: 1 }] : []),
          ...images.map((img, i) => ({ storageId: img.storageId, type: "image" as const, sortOrder: 2 + i })),
        ],
        variants: variants.map((v) => ({ size: v.size, color: v.color, stock: v.stock })),
      });

      if (selectedTagIds.size > 0) {
        await assignTags({ productId, tagIds: Array.from(selectedTagIds) });
      }

      if (preselectedGroupId) {
        await addToDiscountGroup({
          groupId: preselectedGroupId as Id<"discountGroups">,
          productIds: [productId],
        });
      }

      toast.success("Product created successfully");
      router.push(backHref);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to create product");
    } finally {
      setSubmitting(false);
    }
  }

  const discountText = saleEnabled && salePrice
    ? discountDisplay(basePrice, salePrice, saleDisplayMode)
    : null;

  // ── Render ───────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href={backHref}><ArrowLeft className="h-4 w-4 mr-1" />Back</Link>
        </Button>
        <h1 className="text-2xl font-bold">New Product</h1>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 items-start">

          {/* ── Left column ── */}
          <div className="space-y-6">

            {/* Basic Info */}
            <Card>
              <CardHeader><CardTitle>Basic Info</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Name *</Label>
                    <Input id="name" required value={name} onChange={(e) => handleNameChange(e.target.value)} placeholder="Product name" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="slug">Slug *</Label>
                    <Input
                      id="slug" required value={slug}
                      onChange={(e) => { setSlug(e.target.value); setSlugManual(true); }}
                      placeholder="product-slug"
                      className={slugTaken ? "border-destructive" : ""}
                    />
                    {slugTaken && <p className="text-xs text-destructive">This slug is already in use</p>}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sku">SKU</Label>
                  <Input
                    id="sku"
                    value={sku}
                    onChange={(e) => { setSku(e.target.value.toUpperCase()); setSkuManual(true); }}
                    placeholder="Auto-generated"
                    className={`max-w-xs ${skuTaken ? "border-destructive" : ""}`}
                  />
                  {skuTaken
                    ? <p className="text-xs text-destructive">This SKU is already in use</p>
                    : <p className="text-xs text-muted-foreground">Leave blank to auto-generate</p>
                  }
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description *</Label>
                  <Textarea id="description" required value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Product description" rows={4} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Category *</Label>
                  <Select value={categoryId} onValueChange={setCategoryId}>
                    <SelectTrigger id="category"><SelectValue placeholder="Select category" /></SelectTrigger>
                    <SelectContent>
                      {(categories ?? []).map((cat) => (
                        <SelectItem key={cat._id} value={cat._id}>{cat.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Variants & Stock */}
            <Card>
              <CardHeader><CardTitle>Variants & Stock</CardTitle></CardHeader>
              <CardContent>
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
              </CardContent>
            </Card>

            {/* Images */}
            <Card>
              <CardHeader><CardTitle>Images <span className="text-sm font-normal text-muted-foreground">(optional, multiple — drag to reorder)</span></CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <input ref={imageInputRef} type="file" accept="image/*" className="hidden"
                  onChange={async (e) => { const f = e.target.files?.[0]; if (f) await handleImageUpload(f); e.target.value = ""; }} />
                <Button type="button" variant="outline" disabled={uploadingImage} onClick={() => imageInputRef.current?.click()}>
                  {uploadingImage ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Uploading…</> : <><Upload className="mr-2 h-4 w-4" />Upload Image</>}
                </Button>
                {images.length > 0 && (
                  <SortableImageGrid
                    images={images}
                    onReorder={setImages}
                    onRemove={removeImage}
                  />
                )}
              </CardContent>
            </Card>

            {/* Video */}
            <Card>
              <CardHeader><CardTitle>Video <span className="text-sm font-normal text-muted-foreground">(optional)</span></CardTitle></CardHeader>
              <CardContent>
                <input ref={videoInputRef} type="file" accept="video/*" className="hidden"
                  onChange={async (e) => { const f = e.target.files?.[0]; if (f) await handleVideoUpload(f); e.target.value = ""; }} />
                {videoItem ? (
                  <div className="relative group w-48 h-28 rounded-md overflow-hidden border bg-muted">
                    {videoItem.previewUrl ? <video src={videoItem.previewUrl} className="w-full h-full object-cover" muted /> :
                      <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">video</div>}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Button type="button" variant="destructive" size="icon" className="h-7 w-7" onClick={handleRemoveVideo}><X className="h-3 w-3" /></Button>
                    </div>
                  </div>
                ) : (
                  <Button type="button" variant="outline" disabled={uploadingVideo} onClick={() => videoInputRef.current?.click()}>
                    {uploadingVideo ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Uploading…</> : <><Upload className="mr-2 h-4 w-4" />Upload Video</>}
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* 3D Model */}
            <Card>
              <CardHeader><CardTitle>3D Model <span className="text-sm font-normal text-muted-foreground">(optional — GLB format)</span></CardTitle></CardHeader>
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
                    <Button type="button" variant="outline" disabled={uploadingModel3d} onClick={() => model3dInputRef.current?.click()}>
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
              <CardHeader><CardTitle>Availability</CardTitle></CardHeader>
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
                    <Label htmlFor="scheduledPublishTime">Publish date & time *</Label>
                    <Input
                      id="scheduledPublishTime"
                      type="datetime-local"
                      value={scheduledPublishTime}
                      onChange={(e) => setScheduledPublishTime(e.target.value)}
                      required
                    />
                    <p className="text-xs text-muted-foreground">
                      The product will become visible at this time automatically.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Pricing */}
            <Card>
              <CardHeader><CardTitle>Pricing</CardTitle></CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="basePrice">Regular Price (৳) *</Label>
                  <Input
                    id="basePrice" type="number" min="1" step="1" required
                    value={basePrice} onChange={(e) => setBasePrice(e.target.value)}
                    placeholder="0"
                  />
                </div>

                <div className="flex items-center gap-3">
                  <Switch id="saleToggle" checked={saleEnabled} onCheckedChange={setSaleEnabled} />
                  <Label htmlFor="saleToggle" className="cursor-pointer font-medium">Enable Sale Pricing</Label>
                </div>

                {saleEnabled && (
                  <div className="space-y-5 border-l-2 border-muted pl-4">
                    <div className="space-y-2">
                      <Label htmlFor="salePrice">Sale Price (৳)</Label>
                      <Input
                        id="salePrice" type="number" min="0" step="1"
                        value={salePrice} onChange={(e) => setSalePrice(e.target.value)}
                        placeholder="0"
                      />
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
                          <RadioGroupItem value="percentage" id="mode-pct" />
                          <Label htmlFor="mode-pct" className="cursor-pointer font-normal text-sm">Percentage</Label>
                        </div>
                        <div className="flex items-center gap-2">
                          <RadioGroupItem value="amount" id="mode-amt" />
                          <Label htmlFor="mode-amt" className="cursor-pointer font-normal text-sm">Fixed Amount</Label>
                        </div>
                      </RadioGroup>
                      {discountText && (
                        <p className="text-sm font-medium text-green-600">Discount: {discountText}</p>
                      )}
                    </div>

                    {/* Discount Schedule */}
                    <div className="space-y-4">
                      <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Discount Schedule</p>

                      <div className="space-y-2">
                        <Label className="text-sm">Starts</Label>
                        <RadioGroup value={saleStartMode} onValueChange={(v) => setSaleStartMode(v as "immediately" | "custom")} className="gap-2">
                          <div className="flex items-center gap-2">
                            <RadioGroupItem value="immediately" id="start-immediately" />
                            <Label htmlFor="start-immediately" className="cursor-pointer font-normal">Immediately</Label>
                          </div>
                          <div className="flex items-center gap-2">
                            <RadioGroupItem value="custom" id="start-custom" />
                            <Label htmlFor="start-custom" className="cursor-pointer font-normal">Custom date & time</Label>
                          </div>
                        </RadioGroup>
                        {saleStartMode === "custom" && (
                          <Input
                            type="datetime-local"
                            value={saleStartTime}
                            onChange={(e) => handleSaleStartTimeChange(e.target.value)}
                            className="mt-2"
                          />
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label className="text-sm">Ends</Label>
                        <RadioGroup value={saleEndMode} onValueChange={(v) => setSaleEndMode(v as "indefinite" | "custom")} className="gap-2">
                          <div className="flex items-center gap-2">
                            <RadioGroupItem value="indefinite" id="end-indefinite" />
                            <Label htmlFor="end-indefinite" className="cursor-pointer font-normal">Indefinite</Label>
                          </div>
                          <div className="flex items-center gap-2">
                            <RadioGroupItem value="custom" id="end-custom" />
                            <Label htmlFor="end-custom" className="cursor-pointer font-normal">Custom date & time</Label>
                          </div>
                        </RadioGroup>
                        {saleEndMode === "custom" && (
                          <Input
                            type="datetime-local"
                            value={saleEndTime}
                            onChange={(e) => setSaleEndTime(e.target.value)}
                            className="mt-2"
                          />
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
                  <CardTitle>Tags</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                {!tags ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : tags.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No tags available.</p>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {tags.map((tag) => (
                      <div key={tag._id} className="flex items-center gap-2">
                        <Checkbox id={`tag-${tag._id}`} checked={selectedTagIds.has(tag._id)} onCheckedChange={() => toggleTag(tag._id)} />
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
                  <CardTitle>SEO</CardTitle>
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

            {/* Submit */}
            <div className="flex items-center gap-3">
              <Button type="submit" disabled={submitting || !!slugTaken || !!skuTaken || hasNoConfig} className="flex-1">
                {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating…</> : "Create Product"}
              </Button>
              <Button type="button" variant="outline" asChild>
                <Link href={backHref}>Cancel</Link>
              </Button>
            </div>

          </div>
        </div>
      </form>
    </div>
  );
}

// ─── Page (wraps in Suspense for useSearchParams) ─────────────────────────────

export default function NewProductPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}>
      <NewProductForm />
    </Suspense>
  );
}
