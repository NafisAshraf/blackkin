"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { toast } from "sonner";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, ArrowUp, ArrowDown, Loader2, Upload, X } from "lucide-react";
import {
  VariantMatrix,
  matrixToVariants,
  type StockMatrix,
} from "@/components/admin/VariantMatrix";

// ─── Types ────────────────────────────────────────────────────────────────────

interface MediaItem {
  storageId: Id<"_storage">;
  previewUrl: string;
  type: "image" | "video";
}

function slugify(str: string) {
  return str.toLowerCase().trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function NewProductPage() {
  const router = useRouter();

  // Queries
  const categories = useQuery(api.categories.listAll);
  const sizes = useQuery(api.platformConfig.listSizes);
  const colors = useQuery(api.platformConfig.listColors);
  const tags = useQuery(api.tags.list);

  // Mutations
  const createProduct = useMutation(api.products.create);
  const assignTags = useMutation(api.products.assignTags);
  const addAtTop = useMutation(api.recommendations.addAtTop);
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);

  // ── Basic Info ──────────────────────────────────────────────
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugManual, setSlugManual] = useState(false);
  const [debouncedSlug, setDebouncedSlug] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [basePrice, setBasePrice] = useState("");

  // Debounce slug for availability check
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSlug(slug), 400);
    return () => clearTimeout(t);
  }, [slug]);

  const slugAvailable = useQuery(
    api.products.checkSlugAvailable,
    debouncedSlug.trim() ? { slug: debouncedSlug } : "skip"
  );
  const slugTaken = debouncedSlug.trim() && slugAvailable === false;

  // ── Variant Matrix ──────────────────────────────────────────
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [selectedSizes, setSelectedSizes] = useState<string[]>([]);
  const [stockMatrix, setStockMatrix] = useState<StockMatrix>({});

  // Auto-select first available color and size when data loads
  useEffect(() => {
    if (colors && colors.length > 0 && selectedColors.length === 0) {
      const firstColor = colors[0].name;
      setSelectedColors([firstColor]);
      setStockMatrix((prev) => ({ ...prev, [firstColor]: {} }));
    }
  }, [colors]);

  useEffect(() => {
    if (sizes && sizes.length > 0 && selectedSizes.length === 0) {
      setSelectedSizes([sizes[0].name]);
    }
  }, [sizes]);

  // Sync matrix when initial color/size auto-selection completes
  useEffect(() => {
    if (selectedColors.length > 0 && selectedSizes.length > 0) {
      setStockMatrix((prev) => {
        const next: StockMatrix = {};
        for (const color of selectedColors) {
          next[color] = {};
          for (const size of selectedSizes) {
            next[color][size] = prev[color]?.[size] ?? 0;
          }
        }
        return next;
      });
    }
  }, []);

  // ── Media ───────────────────────────────────────────────────
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Tags ─────────────────────────────────────────────────────
  const [selectedTagIds, setSelectedTagIds] = useState<Set<Id<"tags">>>(new Set());

  // ── Featured ─────────────────────────────────────────────────
  const [isFeaturedBestSeller, setIsFeaturedBestSeller] = useState(false);
  const [isFeaturedNewArrival, setIsFeaturedNewArrival] = useState(false);

  // ── Submitting ───────────────────────────────────────────────
  const [submitting, setSubmitting] = useState(false);

  // ── Helpers ──────────────────────────────────────────────────

  function handleNameChange(val: string) {
    setName(val);
    if (!slugManual) setSlug(slugify(val));
  }

  function handleSlugChange(val: string) {
    setSlug(val);
    setSlugManual(true);
  }

  async function handleFileUpload(file: File) {
    // Validate file type
    if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
      toast.error("Only image and video files are allowed");
      return;
    }
    setUploadingMedia(true);
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
      toast.error(err instanceof Error ? err.message : "Media upload failed");
    } finally {
      setUploadingMedia(false);
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

  function toggleTag(tagId: Id<"tags">) {
    setSelectedTagIds((prev) => {
      const next = new Set(prev);
      if (next.has(tagId)) next.delete(tagId);
      else next.add(tagId);
      return next;
    });
  }

  const hasNoConfig = (colors !== undefined && colors.length === 0) ||
    (sizes !== undefined && sizes.length === 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!categoryId) { toast.error("Please select a category"); return; }
    if (!basePrice || isNaN(Number(basePrice)) || Number(basePrice) <= 0) {
      toast.error("Enter a valid base price"); return;
    }
    if (slugTaken) { toast.error("This slug is already in use"); return; }
    if (hasNoConfig) { toast.error("Configure colors and sizes first in Platform Configuration"); return; }
    if (selectedColors.length === 0 || selectedSizes.length === 0) {
      toast.error("Select at least one color and one size"); return;
    }

    setSubmitting(true);
    try {
      const variants = matrixToVariants(stockMatrix, selectedColors, selectedSizes);

      const productId = await createProduct({
        name: name.trim(),
        slug: slug.trim() || slugify(name),
        description: description.trim(),
        categoryId: categoryId as Id<"categories">,
        basePrice: Number(basePrice),
        media: media.map((m, i) => ({ storageId: m.storageId, type: m.type, sortOrder: i })),
        variants: variants.map((v) => ({ size: v.size, color: v.color, stock: v.stock })),
      });

      if (selectedTagIds.size > 0) {
        await assignTags({ productId, tagIds: Array.from(selectedTagIds) });
      }

      if (isFeaturedBestSeller) {
        try {
          await addAtTop({ type: "best_sellers", recommendedProductId: productId });
        } catch {
          toast.warning("Product created but could not add to Best Sellers (may already exist)");
        }
      }
      if (isFeaturedNewArrival) {
        try {
          await addAtTop({ type: "new_arrivals", recommendedProductId: productId });
        } catch {
          toast.warning("Product created but could not add to New Arrivals (may already exist)");
        }
      }

      toast.success("Product created successfully");
      router.push("/admin/products");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to create product");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Render ───────────────────────────────────────────────────

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/admin/products"><ArrowLeft className="h-4 w-4 mr-1" />Back</Link>
        </Button>
        <h1 className="text-2xl font-bold">New Product</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* ── 1. Basic Info ── */}
        <Card>
          <CardHeader><CardTitle>Basic Info</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  required
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="Product name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="slug">Slug *</Label>
                <Input
                  id="slug"
                  required
                  value={slug}
                  onChange={(e) => handleSlugChange(e.target.value)}
                  placeholder="product-slug"
                  className={slugTaken ? "border-destructive" : ""}
                />
                {slugTaken && (
                  <p className="text-xs text-destructive">This slug is already in use</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Product description"
                rows={4}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              <div className="space-y-2">
                <Label htmlFor="basePrice">Base Price (৳) *</Label>
                <Input
                  id="basePrice"
                  type="number"
                  min="1"
                  step="1"
                  required
                  value={basePrice}
                  onChange={(e) => setBasePrice(e.target.value)}
                  placeholder="0"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── 2. Variants ── */}
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

        {/* ── 3. Media ── */}
        <Card>
          <CardHeader><CardTitle>Media</CardTitle></CardHeader>
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
              disabled={uploadingMedia}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploadingMedia ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Uploading…</>
              ) : (
                <><Upload className="mr-2 h-4 w-4" />Upload Image / Video</>
              )}
            </Button>

            {media.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {media.map((item, i) => (
                  <div key={item.storageId} className="relative group rounded-md overflow-hidden border">
                    {item.type === "image" ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.previewUrl} alt={`media-${i}`} className="w-full h-28 object-cover" />
                    ) : (
                      <video src={item.previewUrl} className="w-full h-28 object-cover" muted />
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
          <CardHeader><CardTitle>Tags</CardTitle></CardHeader>
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
                      checked={selectedTagIds.has(tag._id)}
                      onCheckedChange={() => toggleTag(tag._id)}
                    />
                    <Label htmlFor={`tag-${tag._id}`} className="cursor-pointer font-normal">
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
          <CardHeader><CardTitle>Featured</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Enabling these adds the product to the top of that section on the landing page.
            </p>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="bestSeller" className="font-normal cursor-pointer">Best Seller</Label>
                <Switch
                  id="bestSeller"
                  checked={isFeaturedBestSeller}
                  onCheckedChange={setIsFeaturedBestSeller}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="newArrival" className="font-normal cursor-pointer">New Arrival</Label>
                <Switch
                  id="newArrival"
                  checked={isFeaturedNewArrival}
                  onCheckedChange={setIsFeaturedNewArrival}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Submit ── */}
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={submitting || !!slugTaken || hasNoConfig}>
            {submitting ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating…</>
            ) : (
              "Create Product"
            )}
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link href="/admin/products">Cancel</Link>
          </Button>
        </div>
      </form>
    </div>
  );
}
