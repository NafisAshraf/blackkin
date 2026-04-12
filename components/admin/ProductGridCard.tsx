"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Pencil } from "lucide-react";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";

type ProductStatus = "draft" | "active" | "scheduled" | "archived";

interface ProductGridCardProps {
  id: Id<"products">;
  name: string;
  basePrice: number;
  effectivePrice: number;
  discountAmount: number;
  status: ProductStatus;
  imageUrl?: string | null;
  scheduledPublishTime?: number;
  // Enhanced info
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
  // Selection mode
  isSelected?: boolean;
  onToggleSelect?: (e: React.MouseEvent) => void;
  // Quick actions
  onPublish?: (e: React.MouseEvent) => void;
}

const STATUS_BADGE: Record<ProductStatus, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  active: { label: "Active", variant: "default" },
  draft: { label: "Draft", variant: "secondary" },
  scheduled: { label: "Scheduled", variant: "outline" },
  archived: { label: "Archived", variant: "destructive" },
};

export function ProductGridCard({
  id,
  name,
  basePrice,
  effectivePrice,
  discountAmount,
  status,
  imageUrl,
  scheduledPublishTime,
  categoryName,
  totalStock,
  variantCount,
  tags,
  discountSource,
  discountGroupName,
  saleDisplayMode,
  saleStartMode,
  saleStartTime,
  saleEndMode,
  saleEndTime,
  isSelected,
  onToggleSelect,
  onPublish,
}: ProductGridCardProps) {
  const now = Date.now();
  const effectiveStatus: ProductStatus =
    status === "scheduled" && scheduledPublishTime && scheduledPublishTime <= now
      ? "active"
      : status;

  const badge = STATUS_BADGE[effectiveStatus];
  const isOnSale = discountAmount > 0;
  const outOfStock = totalStock !== undefined && totalStock === 0;

  const displayTags = tags?.slice(0, 2) ?? [];
  const extraTagCount = (tags?.length ?? 0) - displayTags.length;

  return (
    <div
      onClick={(e) => {
        if (onToggleSelect) {
          e.preventDefault();
          e.stopPropagation();
          onToggleSelect(e);
        }
      }}
      className={`group relative flex flex-col h-full rounded-lg border bg-card hover:border-foreground/30 transition-colors overflow-hidden ${onToggleSelect ? "cursor-pointer" : ""} ${isSelected ? "border-primary" : ""}`}
    >
      {/* Image */}
      <div className="relative aspect-square bg-muted overflow-hidden">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
            No image
          </div>
        )}
        {isOnSale && (
          <TooltipProvider delayDuration={150}>
            <Tooltip>
              <TooltipTrigger asChild onClick={(e) => e.preventDefault()}>
                <span className="absolute top-2 left-2 bg-destructive/95 backdrop-blur text-white text-[9px] px-1.5 py-0.5 rounded shadow-sm cursor-help ring-1 ring-white/20">
                  {discountSource === "individual" && saleDisplayMode === "amount"
                    ? `৳${discountAmount.toLocaleString()} OFF`
                    : `${Math.round((discountAmount / basePrice) * 100)}% OFF`}
                </span>
              </TooltipTrigger>
              <TooltipContent side="right" className="flex flex-col gap-1 text-xs">
                {discountSource === "group" ? (
                  <>
                    <p className="font-semibold text-destructive">Group Discount</p>
                    <p>Campaign: <span className="font-medium text-foreground">{discountGroupName}</span></p>
                  </>
                ) : discountSource === "individual" ? (
                  <>
                    <p className="font-semibold text-destructive">Individual Sale</p>
                    {saleStartMode === "custom" && saleStartTime ? (
                      <p>Started: <span className="text-muted-foreground">{new Date(saleStartTime).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</span></p>
                    ) : (
                      <p>Started: <span className="text-muted-foreground">Immediately</span></p>
                    )}
                    {saleEndMode === "custom" && saleEndTime ? (
                      <p>Ends: <span className="text-muted-foreground">{new Date(saleEndTime).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</span></p>
                    ) : (
                      <p>Ends: <span className="text-muted-foreground">Indefinite</span></p>
                    )}
                  </>
                ) : (
                  <p className="font-semibold text-destructive">Sale Active</p>
                )}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        {outOfStock && (
          <span className="absolute top-2 right-2 bg-black/70 text-white text-[10px] font-medium px-1.5 py-0.5 rounded">
            Out of stock
          </span>
        )}
        {/* Selection checkbox — shown on hover or when selected */}
        {onToggleSelect && (
          <div
            className={`absolute top-2 left-2 z-10 transition-opacity ${isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleSelect(e); }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <Checkbox
              checked={isSelected ?? false}
              className="bg-background border-2 shadow-sm"
            />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex flex-col gap-1 p-3">
        <p className="text-sm font-medium line-clamp-2 leading-snug">{name}</p>
        {categoryName && (
          <p className="text-[10px] text-muted-foreground truncate">{categoryName}</p>
        )}
        <div className="flex items-center gap-1.5 flex-wrap">
          {isOnSale ? (
            <>
              <span className="text-sm font-semibold">৳{effectivePrice.toLocaleString()}</span>
              <span className="text-xs text-muted-foreground line-through">৳{basePrice.toLocaleString()}</span>
            </>
          ) : (
            <span className="text-sm font-semibold">৳{basePrice.toLocaleString()}</span>
          )}
        </div>

        {/* Stock + variants */}
        {(totalStock !== undefined || variantCount !== undefined) && (
          <div className="flex items-center gap-2 flex-wrap">
            {totalStock !== undefined && (
              <span className={`text-[10px] ${outOfStock ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                {outOfStock ? "Out of stock" : `${totalStock} in stock`}
              </span>
            )}
            {variantCount !== undefined && variantCount > 0 && (
              <span className="text-[10px] text-muted-foreground">{variantCount} variant{variantCount !== 1 ? "s" : ""}</span>
            )}
          </div>
        )}

        <div className="flex items-center gap-1 flex-wrap">
          <Badge variant={badge.variant} className="w-fit text-[10px] px-1.5 py-0">{badge.label}</Badge>
          {displayTags.map((tag) => (
            <span key={tag} className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">{tag}</span>
          ))}
          {extraTagCount > 0 && (
            <span className="text-[10px] text-muted-foreground">+{extraTagCount}</span>
          )}
        </div>
      </div>

      {/* Action Row */}
      <div className="mt-auto p-3 pt-0 flex gap-2 w-full z-10 relative">
        <Button 
          asChild 
          size="sm" 
          variant="secondary" 
          className="h-8 flex-1 text-xs" 
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <Link href={`/admin/products/${id}`}>
            <Pencil className="h-3 w-3 mr-1" /> Edit
          </Link>
        </Button>
        {status === "draft" && onPublish && (
          <Button 
            size="sm" 
            variant="default" 
            className="h-8 flex-1 text-xs"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onPublish(e);
            }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            Publish
          </Button>
        )}
      </div>

      {/* Selection ring */}
      {isSelected && (
        <div className="absolute inset-0 ring-2 ring-primary rounded-lg pointer-events-none" />
      )}
    </div>
  );
}
