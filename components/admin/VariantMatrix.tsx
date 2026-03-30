"use client";

import { Id } from "@/convex/_generated/dataModel";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { AlertCircle } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────

export interface PlatformSize {
  _id: Id<"platformSizes">;
  name: string;
  measurements: string;
  sortOrder: number;
}

export interface PlatformColor {
  _id: Id<"platformColors">;
  name: string;
  hexCode?: string;
  sortOrder: number;
}

/** Flat variant for backend submission */
export interface VariantEntry {
  size: string;
  color: string;
  stock: number;
}

/** stock[colorName][sizeName] = quantity */
export type StockMatrix = Record<string, Record<string, number>>;

interface VariantMatrixProps {
  platformSizes: PlatformSize[] | undefined;
  platformColors: PlatformColor[] | undefined;
  /** Selected color names */
  selectedColors: string[];
  onSelectedColorsChange: (colors: string[]) => void;
  /** Selected size names */
  selectedSizes: string[];
  onSelectedSizesChange: (sizes: string[]) => void;
  /** Stock matrix: stockMatrix[color][size] */
  stockMatrix: StockMatrix;
  onStockMatrixChange: (matrix: StockMatrix) => void;
}

// ─── Helpers ─────────────────────────────────────────────────

function cellClass(stock: number): string {
  if (stock === 0) return "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800";
  if (stock <= 5) return "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800";
  return "";
}

function stockInputClass(stock: number): string {
  if (stock === 0) return "border-red-300 dark:border-red-700 focus-visible:ring-red-400";
  if (stock <= 5) return "border-amber-300 dark:border-amber-700 focus-visible:ring-amber-400";
  return "";
}

// ─── Component ────────────────────────────────────────────────

export function VariantMatrix({
  platformSizes,
  platformColors,
  selectedColors,
  onSelectedColorsChange,
  selectedSizes,
  onSelectedSizesChange,
  stockMatrix,
  onStockMatrixChange,
}: VariantMatrixProps) {
  const sizesLoading = platformSizes === undefined;
  const colorsLoading = platformColors === undefined;

  const noSizes = !sizesLoading && platformSizes.length === 0;
  const noColors = !colorsLoading && platformColors.length === 0;

  function toggleColor(colorName: string) {
    if (selectedColors.includes(colorName)) {
      if (selectedColors.length <= 1) return; // enforce minimum 1
      onSelectedColorsChange(selectedColors.filter((c) => c !== colorName));
      // Remove this color's row from the matrix
      const next = { ...stockMatrix };
      delete next[colorName];
      onStockMatrixChange(next);
    } else {
      onSelectedColorsChange([...selectedColors, colorName]);
      // Add this color's row to the matrix with default 0 stock
      const next = { ...stockMatrix };
      next[colorName] = {};
      for (const size of selectedSizes) {
        next[colorName][size] = 0;
      }
      onStockMatrixChange(next);
    }
  }

  function toggleSize(sizeName: string) {
    if (selectedSizes.includes(sizeName)) {
      if (selectedSizes.length <= 1) return; // enforce minimum 1
      onSelectedSizesChange(selectedSizes.filter((s) => s !== sizeName));
      // Remove this size column from all rows
      const next: StockMatrix = {};
      for (const color of selectedColors) {
        next[color] = { ...(stockMatrix[color] ?? {}) };
        delete next[color][sizeName];
      }
      onStockMatrixChange(next);
    } else {
      onSelectedSizesChange([...selectedSizes, sizeName]);
      // Add this size column with default 0 stock for all selected colors
      const next: StockMatrix = {};
      for (const color of selectedColors) {
        next[color] = { ...(stockMatrix[color] ?? {}) };
        next[color][sizeName] = 0;
      }
      onStockMatrixChange(next);
    }
  }

  function setStock(colorName: string, sizeName: string, value: number) {
    const next: StockMatrix = {};
    for (const c of selectedColors) {
      next[c] = { ...(stockMatrix[c] ?? {}) };
    }
    if (!next[colorName]) next[colorName] = {};
    next[colorName][sizeName] = value;
    onStockMatrixChange(next);
  }

  // Totals
  const rowTotals: Record<string, number> = {};
  for (const color of selectedColors) {
    rowTotals[color] = selectedSizes.reduce(
      (sum, size) => sum + (stockMatrix[color]?.[size] ?? 0),
      0
    );
  }
  const colTotals: Record<string, number> = {};
  for (const size of selectedSizes) {
    colTotals[size] = selectedColors.reduce(
      (sum, color) => sum + (stockMatrix[color]?.[size] ?? 0),
      0
    );
  }
  const grandTotal = Object.values(rowTotals).reduce((s, v) => s + v, 0);
  const totalVariants = selectedColors.length * selectedSizes.length;
  const zeroStockCount = selectedColors.reduce(
    (sum, color) =>
      sum + selectedSizes.filter((size) => (stockMatrix[color]?.[size] ?? 0) === 0).length,
    0
  );

  // ── Empty states ─────────────────────────────────────────

  if (noColors || noSizes) {
    return (
      <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950/20 p-4 text-amber-800 dark:text-amber-200">
        <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-medium">
            {noColors && noSizes
              ? "No colors or sizes configured"
              : noColors
              ? "No colors configured"
              : "No sizes configured"}
          </p>
          <p className="mt-0.5 text-amber-700 dark:text-amber-300">
            Go to <strong>Platform Configuration</strong> and add{" "}
            {noColors && noSizes ? "colors and sizes" : noColors ? "colors" : "sizes"} first.
          </p>
        </div>
      </div>
    );
  }

  if (sizesLoading || colorsLoading) {
    return <p className="text-sm text-muted-foreground">Loading colors and sizes…</p>;
  }

  return (
    <div className="space-y-5">
      {/* ── Color chips ── */}
      <div className="space-y-2">
        <p className="text-sm font-medium">Colors</p>
        <div className="flex flex-wrap gap-2">
          {platformColors.map((color) => {
            const active = selectedColors.includes(color.name);
            const isLast = active && selectedColors.length === 1;
            return (
              <button
                key={color._id}
                type="button"
                title={color.name}
                disabled={isLast}
                onClick={() => toggleColor(color.name)}
                className={cn(
                  "flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium transition-colors",
                  active
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-background text-muted-foreground hover:text-foreground hover:border-foreground",
                  isLast && "opacity-50 cursor-not-allowed"
                )}
              >
                {color.hexCode && (
                  <span
                    className="h-3 w-3 rounded-full border border-white/30 shrink-0"
                    style={{ backgroundColor: color.hexCode }}
                  />
                )}
                <span className="max-w-[100px] truncate">{color.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Size chips ── */}
      <div className="space-y-2">
        <p className="text-sm font-medium">Sizes</p>
        <div className="flex flex-wrap gap-2">
          {platformSizes.map((size) => {
            const active = selectedSizes.includes(size.name);
            const isLast = active && selectedSizes.length === 1;
            return (
              <button
                key={size._id}
                type="button"
                title={size.name}
                disabled={isLast}
                onClick={() => toggleSize(size.name)}
                className={cn(
                  "rounded-full border px-3 py-1 text-sm font-medium transition-colors",
                  active
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-background text-muted-foreground hover:text-foreground hover:border-foreground",
                  isLast && "opacity-50 cursor-not-allowed"
                )}
              >
                <span className="max-w-[100px] truncate">{size.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Stock matrix ── */}
      {selectedColors.length > 0 && selectedSizes.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-medium">Stock</p>
          <div className="overflow-x-auto rounded-md border">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground w-32">Color</th>
                  {selectedSizes.map((size) => (
                    <th key={size} className="px-2 py-2 text-center font-medium min-w-[80px]">
                      <span className="max-w-[80px] truncate block" title={size}>{size}</span>
                    </th>
                  ))}
                  <th className="px-3 py-2 text-center font-medium text-muted-foreground">Total</th>
                </tr>
              </thead>
              <tbody>
                {selectedColors.map((colorName) => {
                  const colorDef = platformColors.find((c) => c.name === colorName);
                  return (
                    <tr key={colorName} className="border-b last:border-0">
                      <td className="px-3 py-2 font-medium">
                        <div className="flex items-center gap-1.5">
                          {colorDef?.hexCode && (
                            <span
                              className="h-3 w-3 rounded-full border shrink-0"
                              style={{ backgroundColor: colorDef.hexCode }}
                            />
                          )}
                          <span className="max-w-[90px] truncate" title={colorName}>
                            {colorName}
                          </span>
                        </div>
                      </td>
                      {selectedSizes.map((sizeName) => {
                        const stock = stockMatrix[colorName]?.[sizeName] ?? 0;
                        return (
                          <td key={sizeName} className={cn("px-2 py-1.5", cellClass(stock))}>
                            <Input
                              type="number"
                              min="0"
                              step="1"
                              value={stock}
                              onChange={(e) =>
                                setStock(colorName, sizeName, Math.max(0, parseInt(e.target.value) || 0))
                              }
                              className={cn(
                                "h-8 w-16 text-center text-xs px-1",
                                stockInputClass(stock)
                              )}
                            />
                          </td>
                        );
                      })}
                      <td className="px-3 py-2 text-center font-medium text-muted-foreground">
                        {rowTotals[colorName] ?? 0}
                      </td>
                    </tr>
                  );
                })}
                {/* Column totals row */}
                <tr className="bg-muted/50 border-t">
                  <td className="px-3 py-2 font-medium text-muted-foreground text-xs">Total</td>
                  {selectedSizes.map((sizeName) => (
                    <td key={sizeName} className="px-2 py-2 text-center font-medium text-muted-foreground">
                      {colTotals[sizeName] ?? 0}
                    </td>
                  ))}
                  <td className="px-3 py-2 text-center font-bold">{grandTotal}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Summary bar */}
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            <span>
              <strong className="text-foreground">{grandTotal}</strong> total units
            </span>
            <span>
              <strong className="text-foreground">{totalVariants}</strong> variants
            </span>
            {zeroStockCount > 0 && (
              <span className="text-red-600 dark:text-red-400">
                <strong>{zeroStockCount}</strong> at zero stock
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** Convert a StockMatrix + selected colors/sizes into a flat variants array for mutation */
export function matrixToVariants(
  stockMatrix: StockMatrix,
  selectedColors: string[],
  selectedSizes: string[]
): VariantEntry[] {
  const variants: VariantEntry[] = [];
  for (const color of selectedColors) {
    for (const size of selectedSizes) {
      variants.push({
        color,
        size,
        stock: stockMatrix[color]?.[size] ?? 0,
      });
    }
  }
  return variants;
}

/** Build initial state from existing variants (for edit mode) */
export function variantsToMatrix(
  variants: { size: string; color?: string; stock: number }[]
): {
  selectedColors: string[];
  selectedSizes: string[];
  stockMatrix: StockMatrix;
} {
  const colorsSet = new Set<string>();
  const sizesSet = new Set<string>();
  const matrix: StockMatrix = {};

  for (const v of variants) {
    const color = v.color ?? "__no_color__";
    colorsSet.add(color);
    sizesSet.add(v.size);
    if (!matrix[color]) matrix[color] = {};
    matrix[color][v.size] = v.stock;
  }

  return {
    selectedColors: Array.from(colorsSet),
    selectedSizes: Array.from(sizesSet),
    stockMatrix: matrix,
  };
}
