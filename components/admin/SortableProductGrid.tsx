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
import { Id } from "@/convex/_generated/dataModel";
import { ProductGridCard } from "./ProductGridCard";

type ProductStatus = "draft" | "active" | "scheduled" | "archived";

export interface SortableProductItem {
  id: Id<"products">;
  name: string;
  basePrice: number;
  effectivePrice: number;
  discountAmount: number;
  status: ProductStatus;
  imageUrl?: string | null;
  scheduledPublishTime?: number;
  categoryName?: string;
  totalStock?: number;
  variantCount?: number;
  tags?: string[];
  discountSource?: "group" | "individual" | null;
  discountGroupName?: string | null;
  saleDisplayMode?: "percentage" | "amount" | null;
  saleStartMode?: "immediately" | "custom" | null;
  saleStartTime?: number | null;
  saleEndMode?: "indefinite" | "custom" | null;
  saleEndTime?: number | null;
}

interface SortableProductGridProps {
  items: SortableProductItem[];
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onReorder: (newOrder: { id: Id<"products">; sortOrder: number }[]) => void;
  /** Slot prepended before the sortable items (e.g. AddProductCard) */
  prefix?: React.ReactNode;
  onPublish?: (id: Id<"products">) => void;
}

// ─── Sortable Card ─────────────────────────────────────────────────────────────

function SortableProductCard({
  item,
  isSelected,
  onToggleSelect,
  onPublish,
}: {
  item: SortableProductItem;
  isSelected: boolean;
  onToggleSelect?: (id: string) => void;
  onPublish?: (id: Id<"products">) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

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
      {...attributes}
      {...listeners}
      className="touch-none select-none"
    >
      <ProductGridCard
        id={item.id}
        name={item.name}
        basePrice={item.basePrice}
        effectivePrice={item.effectivePrice}
        discountAmount={item.discountAmount}
        status={item.status}
        imageUrl={item.imageUrl}
        scheduledPublishTime={item.scheduledPublishTime}
        categoryName={item.categoryName}
        totalStock={item.totalStock}
        variantCount={item.variantCount}
        tags={item.tags}
        discountSource={item.discountSource}
        discountGroupName={item.discountGroupName}
        saleDisplayMode={item.saleDisplayMode}
        saleStartMode={item.saleStartMode}
        saleStartTime={item.saleStartTime}
        saleEndMode={item.saleEndMode}
        saleEndTime={item.saleEndTime}
        isSelected={isSelected}
        onToggleSelect={
          onToggleSelect
            ? (e) => {
                e.preventDefault();
                e.stopPropagation();
                onToggleSelect(item.id);
              }
            : undefined
        }
        onPublish={onPublish ? () => onPublish(item.id) : undefined}
      />
    </div>
  );
}

// ─── Grid ───────────────────────────────────────────────────────────────────────

export function SortableProductGrid({
  items,
  selectedIds,
  onToggleSelect,
  onReorder,
  prefix,
  onPublish,
}: SortableProductGridProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = items.findIndex((item) => item.id === active.id);
    const newIndex = items.findIndex((item) => item.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(items, oldIndex, newIndex);
    onReorder(reordered.map((item, i) => ({ id: item.id, sortOrder: i })));
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={items.map((item) => item.id)}
        strategy={rectSortingStrategy}
      >
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {prefix}
          {items.map((item) => (
            <SortableProductCard
              key={item.id}
              item={item}
              isSelected={selectedIds?.has(item.id) ?? false}
              onToggleSelect={onToggleSelect}
              onPublish={onPublish}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
