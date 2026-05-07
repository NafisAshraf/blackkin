"use client";

import { useRef, useState } from "react";
import {
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Box,
  ChevronDown,
  ChevronUp,
  GripVertical,
  Loader2,
  Upload,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────

export type VariantMediaType = "image" | "video" | "model3d";

export interface VariantMediaItem {
  /** storageId / R2 key */
  storageId: string;
  type: VariantMediaType;
  /** Ephemeral object URL for preview — not persisted */
  previewUrl: string | null;
}

export interface ThumbnailItem {
  storageId: string;
  previewUrl: string | null;
}

interface ColorVariantMediaSectionProps {
  /** Active colors from the VariantMatrix */
  colors: string[];
  /** Per-color ordered media list (controlled) */
  variantMediaMap: Record<string, VariantMediaItem[]>;
  onChange: (map: Record<string, VariantMediaItem[]>) => void;
  /** Product-level thumbnail (controlled) */
  thumbnailItem: ThumbnailItem | null;
  onThumbnailChange: (item: ThumbnailItem | null) => void;
  /** Second hover thumbnail shown on card hover */
  hoverThumbnailItem: ThumbnailItem | null;
  onHoverThumbnailChange: (item: ThumbnailItem | null) => void;
  /** Shared media shown above all color variants on the product detail page */
  commonMediaTop: VariantMediaItem[];
  onCommonMediaTopChange: (items: VariantMediaItem[]) => void;
  /** Shared media shown below all color variants on the product detail page */
  commonMediaBottom: VariantMediaItem[];
  onCommonMediaBottomChange: (items: VariantMediaItem[]) => void;
  /** R2 upload fn (returns storageId) */
  onUpload: (file: File) => Promise<string>;
  /** R2 delete fn */
  onDelete: (key: string) => void;
}

// ─── Sortable media card ───────────────────────────────────────

function SortableMediaCard({
  item,
  index,
  onRemove,
}: {
  item: VariantMediaItem;
  index: number;
  onRemove: (storageId: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.storageId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 10 : undefined,
    position: isDragging ? ("relative" as const) : undefined,
  };

  const typeLabel =
    item.type === "video" ? "Video" : item.type === "model3d" ? "3D" : null;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="relative group rounded-md overflow-hidden border bg-muted select-none"
    >
      {item.type === "image" ? (
        item.previewUrl ? (
          <img
            src={item.previewUrl}
            alt={`media-${index}`}
            className="w-full h-28 object-cover pointer-events-none"
            draggable={false}
          />
        ) : (
          <div className="w-full h-28 flex items-center justify-center text-xs text-muted-foreground">
            image
          </div>
        )
      ) : item.type === "video" ? (
        item.previewUrl ? (
          <video
            src={item.previewUrl}
            className="w-full h-28 object-cover pointer-events-none"
            muted
          />
        ) : (
          <div className="w-full h-28 flex items-center justify-center text-xs text-muted-foreground">
            video
          </div>
        )
      ) : (
        <div className="w-full h-28 flex flex-col items-center justify-center gap-1 text-xs text-muted-foreground">
          <Box className="h-6 w-6" />
          <span>3D Model</span>
        </div>
      )}

      {/* Type badge */}
      {typeLabel && (
        <span className="absolute top-1 left-1 text-[10px] bg-black/70 text-white px-1.5 py-0.5 rounded">
          {typeLabel}
        </span>
      )}

      {/* Drag handle */}
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="absolute top-1 right-1 h-6 w-6 flex items-center justify-center bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing touch-none rounded"
        aria-label="Drag to reorder"
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>

      {/* Delete button */}
      <Button
        type="button"
        variant="destructive"
        size="icon"
        className="absolute bottom-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={() => onRemove(item.storageId)}
      >
        <X className="h-3 w-3" />
      </Button>
    </div>
  );
}

// ─── Per-color panel ───────────────────────────────────────────

function ColorMediaPanel({
  color,
  items,
  onItemsChange,
  onUpload,
  onDelete,
}: {
  color: string;
  items: VariantMediaItem[];
  onItemsChange: (items: VariantMediaItem[]) => void;
  onUpload: (file: File) => Promise<string>;
  onDelete: (key: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [uploadingModel3d, setUploadingModel3d] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const model3dInputRef = useRef<HTMLInputElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const hasVideo = items.some((m) => m.type === "video");
  const hasModel3d = items.some((m) => m.type === "model3d");

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((m) => m.storageId === active.id);
    const newIndex = items.findIndex((m) => m.storageId === over.id);
    if (oldIndex !== -1 && newIndex !== -1) {
      onItemsChange(arrayMove(items, oldIndex, newIndex));
    }
  }

  async function handleImageUpload(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Only image files are allowed");
      return;
    }
    setUploadingImage(true);
    try {
      const storageId = await onUpload(file);
      onItemsChange([
        ...items,
        { storageId, type: "image", previewUrl: URL.createObjectURL(file) },
      ]);
    } catch {
      toast.error("Upload failed");
    } finally {
      setUploadingImage(false);
    }
  }

  async function handleVideoUpload(file: File) {
    if (!file.type.startsWith("video/")) {
      toast.error("Only video files are allowed");
      return;
    }
    setUploadingVideo(true);
    try {
      const storageId = await onUpload(file);
      onItemsChange([
        ...items,
        { storageId, type: "video", previewUrl: URL.createObjectURL(file) },
      ]);
    } catch {
      toast.error("Upload failed");
    } finally {
      setUploadingVideo(false);
    }
  }

  async function handleModel3dUpload(file: File) {
    if (!file.name.toLowerCase().endsWith(".glb")) {
      toast.error("Only .glb files are supported");
      return;
    }
    setUploadingModel3d(true);
    try {
      const storageId = await onUpload(file);
      onItemsChange([
        ...items,
        { storageId, type: "model3d", previewUrl: null },
      ]);
    } catch {
      toast.error("Upload failed");
    } finally {
      setUploadingModel3d(false);
    }
  }

  function handleRemove(storageId: string) {
    onItemsChange(items.filter((m) => m.storageId !== storageId));
    onDelete(storageId);
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Color header */}
      <button
        type="button"
        className="w-full flex items-center justify-between px-4 py-3 bg-muted/50 hover:bg-muted transition-colors text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center gap-2">
          <div
            className="h-4 w-4 rounded-full border"
            style={{ backgroundColor: color.toLowerCase() }}
          />
          <span className="font-medium text-sm capitalize">{color}</span>
          <span className="text-xs text-muted-foreground">
            ({items.length} item{items.length !== 1 ? "s" : ""})
          </span>
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {open && (
        <div className="p-4 space-y-4">
          {/* Upload buttons */}
          <div className="flex flex-wrap gap-2">
            {/* Image upload */}
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (f) await handleImageUpload(f);
                e.target.value = "";
              }}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={uploadingImage}
              onClick={() => imageInputRef.current?.click()}
            >
              {uploadingImage ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Upload className="mr-1.5 h-3.5 w-3.5" />
              )}
              Add Image
            </Button>

            {/* Video upload — disabled when one exists */}
            <input
              ref={videoInputRef}
              type="file"
              accept="video/*"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (f) await handleVideoUpload(f);
                e.target.value = "";
              }}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={uploadingVideo || hasVideo}
              title={hasVideo ? "Remove existing video first" : undefined}
              onClick={() => videoInputRef.current?.click()}
            >
              {uploadingVideo ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Upload className="mr-1.5 h-3.5 w-3.5" />
              )}
              {hasVideo ? "Video added" : "Add Video"}
            </Button>

            {/* 3D model upload — disabled when one exists */}
            <input
              ref={model3dInputRef}
              type="file"
              accept=".glb"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (f) await handleModel3dUpload(f);
                e.target.value = "";
              }}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={uploadingModel3d || hasModel3d}
              title={hasModel3d ? "Remove existing 3D model first" : undefined}
              onClick={() => model3dInputRef.current?.click()}
            >
              {uploadingModel3d ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Box className="mr-1.5 h-3.5 w-3.5" />
              )}
              {hasModel3d ? "3D added" : "Add 3D"}
            </Button>
          </div>

          {/* Sortable media grid */}
          {items.length > 0 && (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={items.map((m) => m.storageId)}
                strategy={rectSortingStrategy}
              >
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                  {items.map((item, i) => (
                    <SortableMediaCard
                      key={item.storageId}
                      item={item}
                      index={i}
                      onRemove={handleRemove}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}

          {items.length === 0 && (
            <p className="text-xs text-muted-foreground">
              No media yet. Upload images, a video, or a 3D model above.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Shared (non-color-specific) media panel ──────────────────

function CommonMediaPanel({
  label,
  items,
  onItemsChange,
  onUpload,
  onDelete,
}: {
  label: string;
  items: VariantMediaItem[];
  onItemsChange: (items: VariantMediaItem[]) => void;
  onUpload: (file: File) => Promise<string>;
  onDelete: (key: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [uploadingModel3d, setUploadingModel3d] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const model3dInputRef = useRef<HTMLInputElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const hasVideo = items.some((m) => m.type === "video");
  const hasModel3d = items.some((m) => m.type === "model3d");

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((m) => m.storageId === active.id);
    const newIndex = items.findIndex((m) => m.storageId === over.id);
    if (oldIndex !== -1 && newIndex !== -1)
      onItemsChange(arrayMove(items, oldIndex, newIndex));
  }

  async function handleImageUpload(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Only image files are allowed");
      return;
    }
    setUploadingImage(true);
    try {
      const storageId = await onUpload(file);
      onItemsChange([
        ...items,
        { storageId, type: "image", previewUrl: URL.createObjectURL(file) },
      ]);
    } catch {
      toast.error("Upload failed");
    } finally {
      setUploadingImage(false);
    }
  }

  async function handleVideoUpload(file: File) {
    if (!file.type.startsWith("video/")) {
      toast.error("Only video files are allowed");
      return;
    }
    setUploadingVideo(true);
    try {
      const storageId = await onUpload(file);
      onItemsChange([
        ...items,
        { storageId, type: "video", previewUrl: URL.createObjectURL(file) },
      ]);
    } catch {
      toast.error("Upload failed");
    } finally {
      setUploadingVideo(false);
    }
  }

  async function handleModel3dUpload(file: File) {
    if (!file.name.toLowerCase().endsWith(".glb")) {
      toast.error("Only .glb files are supported");
      return;
    }
    setUploadingModel3d(true);
    try {
      const storageId = await onUpload(file);
      onItemsChange([
        ...items,
        { storageId, type: "model3d", previewUrl: null },
      ]);
    } catch {
      toast.error("Upload failed");
    } finally {
      setUploadingModel3d(false);
    }
  }

  function handleRemove(storageId: string) {
    onItemsChange(items.filter((m) => m.storageId !== storageId));
    onDelete(storageId);
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        type="button"
        className="w-full flex items-center justify-between px-4 py-3 bg-muted/50 hover:bg-muted transition-colors text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">{label}</span>
          <span className="text-xs text-muted-foreground">
            ({items.length} item{items.length !== 1 ? "s" : ""})
          </span>
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>
      {open && (
        <div className="p-4 space-y-4">
          <div className="flex flex-wrap gap-2">
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (f) await handleImageUpload(f);
                e.target.value = "";
              }}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={uploadingImage}
              onClick={() => imageInputRef.current?.click()}
            >
              {uploadingImage ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Upload className="mr-1.5 h-3.5 w-3.5" />
              )}
              Add Image
            </Button>
            <input
              ref={videoInputRef}
              type="file"
              accept="video/*"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (f) await handleVideoUpload(f);
                e.target.value = "";
              }}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={uploadingVideo || hasVideo}
              title={hasVideo ? "Remove existing video first" : undefined}
              onClick={() => videoInputRef.current?.click()}
            >
              {uploadingVideo ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Upload className="mr-1.5 h-3.5 w-3.5" />
              )}
              {hasVideo ? "Video added" : "Add Video"}
            </Button>
            <input
              ref={model3dInputRef}
              type="file"
              accept=".glb"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (f) await handleModel3dUpload(f);
                e.target.value = "";
              }}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={uploadingModel3d || hasModel3d}
              title={hasModel3d ? "Remove existing 3D model first" : undefined}
              onClick={() => model3dInputRef.current?.click()}
            >
              {uploadingModel3d ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Box className="mr-1.5 h-3.5 w-3.5" />
              )}
              {hasModel3d ? "3D added" : "Add 3D"}
            </Button>
          </div>
          {items.length > 0 && (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={items.map((m) => m.storageId)}
                strategy={rectSortingStrategy}
              >
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                  {items.map((item, i) => (
                    <SortableMediaCard
                      key={item.storageId}
                      item={item}
                      index={i}
                      onRemove={handleRemove}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
          {items.length === 0 && (
            <p className="text-xs text-muted-foreground">
              No media yet. Upload images, a video, or a 3D model above.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────

export function ColorVariantMediaSection({
  colors,
  variantMediaMap,
  onChange,
  thumbnailItem,
  onThumbnailChange,
  hoverThumbnailItem,
  onHoverThumbnailChange,
  commonMediaTop,
  onCommonMediaTopChange,
  commonMediaBottom,
  onCommonMediaBottomChange,
  onUpload,
  onDelete,
}: ColorVariantMediaSectionProps) {
  const [uploadingThumbnail, setUploadingThumbnail] = useState(false);
  const [uploadingHoverThumbnail, setUploadingHoverThumbnail] = useState(false);
  const thumbnailInputRef = useRef<HTMLInputElement>(null);
  const hoverThumbnailInputRef = useRef<HTMLInputElement>(null);

  async function handleThumbnailUpload(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Only image files are allowed for thumbnail");
      return;
    }
    setUploadingThumbnail(true);
    try {
      const oldKey = thumbnailItem?.storageId;
      const storageId = await onUpload(file);
      if (oldKey) onDelete(oldKey);
      onThumbnailChange({ storageId, previewUrl: URL.createObjectURL(file) });
    } catch {
      toast.error("Upload failed");
    } finally {
      setUploadingThumbnail(false);
    }
  }

  function handleRemoveThumbnail() {
    if (thumbnailItem) {
      onDelete(thumbnailItem.storageId);
      onThumbnailChange(null);
    }
  }

  async function handleHoverThumbnailUpload(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Only image files are allowed for thumbnail");
      return;
    }
    setUploadingHoverThumbnail(true);
    try {
      const oldKey = hoverThumbnailItem?.storageId;
      const storageId = await onUpload(file);
      if (oldKey) onDelete(oldKey);
      onHoverThumbnailChange({
        storageId,
        previewUrl: URL.createObjectURL(file),
      });
    } catch {
      toast.error("Upload failed");
    } finally {
      setUploadingHoverThumbnail(false);
    }
  }

  function handleRemoveHoverThumbnail() {
    if (hoverThumbnailItem) {
      onDelete(hoverThumbnailItem.storageId);
      onHoverThumbnailChange(null);
    }
  }

  function handleColorItemsChange(color: string, items: VariantMediaItem[]) {
    onChange({ ...variantMediaMap, [color]: items });
  }

  return (
    <div className="space-y-6">
      {/* Thumbnails */}
      <Card>
        <CardHeader>
          <CardTitle>
            Thumbnails{" "}
            <span className="text-sm font-normal text-muted-foreground">
              (shown on listing cards)
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Primary thumbnail */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Primary</p>
            <input
              ref={thumbnailInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (f) await handleThumbnailUpload(f);
                e.target.value = "";
              }}
            />
            {thumbnailItem ? (
              <div className="flex items-start gap-4">
                <div className="relative group w-32 h-32 rounded-md overflow-hidden border bg-muted shrink-0">
                  {thumbnailItem.previewUrl ? (
                    <img
                      src={thumbnailItem.previewUrl}
                      alt="Thumbnail"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
                      thumbnail
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="h-7 w-7"
                      onClick={handleRemoveThumbnail}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={uploadingThumbnail}
                  onClick={() => thumbnailInputRef.current?.click()}
                >
                  Replace
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                disabled={uploadingThumbnail}
                onClick={() => thumbnailInputRef.current?.click()}
              >
                {uploadingThumbnail ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Uploading…
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Upload Thumbnail
                  </>
                )}
              </Button>
            )}
            <p className="text-xs text-muted-foreground">
              Shown as default card image. Recommended: square, at least
              600×600px.
            </p>
          </div>

          {/* Hover thumbnail */}
          <div className="space-y-2 border-t pt-4">
            <p className="text-sm font-medium">
              Hover Image{" "}
              <span className="text-muted-foreground font-normal">
                (shown when card is hovered)
              </span>
            </p>
            <input
              ref={hoverThumbnailInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (f) await handleHoverThumbnailUpload(f);
                e.target.value = "";
              }}
            />
            {hoverThumbnailItem ? (
              <div className="flex items-start gap-4">
                <div className="relative group w-32 h-32 rounded-md overflow-hidden border bg-muted shrink-0">
                  {hoverThumbnailItem.previewUrl ? (
                    <img
                      src={hoverThumbnailItem.previewUrl}
                      alt="Hover Thumbnail"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
                      hover
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="h-7 w-7"
                      onClick={handleRemoveHoverThumbnail}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={uploadingHoverThumbnail}
                  onClick={() => hoverThumbnailInputRef.current?.click()}
                >
                  Replace
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                disabled={uploadingHoverThumbnail}
                onClick={() => hoverThumbnailInputRef.current?.click()}
              >
                {uploadingHoverThumbnail ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Uploading…
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Upload Hover Image
                  </>
                )}
              </Button>
            )}
            <p className="text-xs text-muted-foreground">
              Optional second image displayed when hovering over the product
              card.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Common Media — Top */}
      <Card>
        <CardHeader>
          <CardTitle>
            Common Media — Top{" "}
            <span className="text-sm font-normal text-muted-foreground">
              (shown above color-specific media on the product page)
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <CommonMediaPanel
            label="Shared top media"
            items={commonMediaTop}
            onItemsChange={onCommonMediaTopChange}
            onUpload={onUpload}
            onDelete={onDelete}
          />
        </CardContent>
      </Card>

      {/* Per-color media */}
      <Card>
        <CardHeader>
          <CardTitle>
            Color Variant Media{" "}
            <span className="text-sm font-normal text-muted-foreground">
              (images, video, 3D — drag to reorder)
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {colors.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Add colors in Variants &amp; Stock to manage per-color media.
            </p>
          ) : (
            colors.map((color) => (
              <ColorMediaPanel
                key={color}
                color={color}
                items={variantMediaMap[color] ?? []}
                onItemsChange={(items) => handleColorItemsChange(color, items)}
                onUpload={onUpload}
                onDelete={onDelete}
              />
            ))
          )}
        </CardContent>
      </Card>

      {/* Common Media — Bottom */}
      <Card>
        <CardHeader>
          <CardTitle>
            Common Media — Bottom{" "}
            <span className="text-sm font-normal text-muted-foreground">
              (shown below color-specific media on the product page)
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <CommonMediaPanel
            label="Shared bottom media"
            items={commonMediaBottom}
            onItemsChange={onCommonMediaBottomChange}
            onUpload={onUpload}
            onDelete={onDelete}
          />
        </CardContent>
      </Card>
    </div>
  );
}
