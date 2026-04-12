"use client";

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
import { GripVertical, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Id } from "@/convex/_generated/dataModel";

// ─── Types ────────────────────────────────────────────────────

export interface ImageMediaItem {
  storageId: Id<"_storage">;
  previewUrl: string | null;
}

interface SortableImageGridProps {
  images: ImageMediaItem[];
  onReorder: (images: ImageMediaItem[]) => void;
  onRemove: (storageId: Id<"_storage">) => void;
}

// ─── Sortable Card ────────────────────────────────────────────

function SortableImageCard({
  item,
  index,
  onRemove,
}: {
  item: ImageMediaItem;
  index: number;
  onRemove: (storageId: Id<"_storage">) => void;
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

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="relative group rounded-md overflow-hidden border bg-muted select-none"
    >
      {/* Image */}
      {item.previewUrl ? (
        <img
          src={item.previewUrl}
          alt={`image-${index}`}
          className="w-full h-28 object-cover pointer-events-none"
          draggable={false}
        />
      ) : (
        <div className="w-full h-28 flex items-center justify-center text-xs text-muted-foreground">
          image
        </div>
      )}

      {/* Drag handle — top-right, visible on hover */}
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="absolute top-1 right-1 h-6 w-6 flex items-center justify-center bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing touch-none rounded"
        aria-label="Drag to reorder"
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>

      {/* Delete button — bottom-right, visible on hover */}
      <Button
        type="button"
        variant="destructive"
        size="icon"
        className="absolute bottom-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={() => onRemove(item.storageId)}
      >
        <X className="h-3 w-3" />
      </Button>

      {/* Cover badge — first image */}
      {index === 0 && (
        <span className="absolute top-1 left-1 text-[10px] bg-black/70 text-white px-1.5 py-0.5 rounded">
          Cover
        </span>
      )}
    </div>
  );
}

// ─── Grid ─────────────────────────────────────────────────────

export function SortableImageGrid({
  images,
  onReorder,
  onRemove,
}: SortableImageGridProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = images.findIndex((img) => img.storageId === active.id);
    const newIndex = images.findIndex((img) => img.storageId === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    onReorder(arrayMove(images, oldIndex, newIndex));
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={images.map((img) => img.storageId)}
        strategy={rectSortingStrategy}
      >
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {images.map((item, i) => (
            <SortableImageCard
              key={item.storageId}
              item={item}
              index={i}
              onRemove={onRemove}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
