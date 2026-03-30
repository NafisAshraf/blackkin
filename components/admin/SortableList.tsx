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
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { ReactNode } from "react";

// ─── Types ────────────────────────────────────────────────────

interface SortableItem {
  _id: string;
  sortOrder: number;
}

interface DragHandleProps {
  attributes: ReturnType<typeof useSortable>["attributes"];
  listeners: ReturnType<typeof useSortable>["listeners"];
}

interface SortableListProps<T extends SortableItem> {
  items: T[];
  onReorder: (reordered: { id: string; sortOrder: number }[]) => void;
  renderItem: (item: T, dragHandle: ReactNode) => ReactNode;
}

// ─── SortableRow ─────────────────────────────────────────────

function SortableRow<T extends SortableItem>({
  item,
  renderItem,
}: {
  item: T;
  renderItem: (item: T, dragHandle: ReactNode) => ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item._id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
    position: isDragging ? ("relative" as const) : undefined,
  };

  const dragHandle = (
    <button
      type="button"
      {...attributes}
      {...listeners}
      className="cursor-grab active:cursor-grabbing p-1 text-muted-foreground hover:text-foreground touch-none"
      aria-label="Drag to reorder"
    >
      <GripVertical className="h-4 w-4" />
    </button>
  );

  return (
    <div ref={setNodeRef} style={style}>
      {renderItem(item, dragHandle)}
    </div>
  );
}

// ─── SortableList ─────────────────────────────────────────────

export function SortableList<T extends SortableItem>({
  items,
  onReorder,
  renderItem,
}: SortableListProps<T>) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = items.findIndex((item) => item._id === active.id);
    const newIndex = items.findIndex((item) => item._id === over.id);
    const reordered = arrayMove(items, oldIndex, newIndex);

    onReorder(reordered.map((item, i) => ({ id: item._id, sortOrder: i })));
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={items.map((item) => item._id)}
        strategy={verticalListSortingStrategy}
      >
        {items.map((item) => (
          <SortableRow key={item._id} item={item} renderItem={renderItem} />
        ))}
      </SortableContext>
    </DndContext>
  );
}
