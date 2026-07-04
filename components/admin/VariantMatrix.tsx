"use client";

import { Id } from "@/convex/_generated/dataModel";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { AlertCircle } from "lucide-react";

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

export interface VariantEntry {
  id?: Id<"productVariants">;
  sizeId?: Id<"platformSizes">;
  size: string;
  color: string;
  stock: number;
}

export type StockCell = {
  stock: number;
  variantId?: Id<"productVariants">;
};

/** stock[colorName][sizeId] = stock cell */
export type StockMatrix = Record<string, Record<string, StockCell>>;

interface VariantMatrixProps {
  platformSizes: PlatformSize[] | undefined;
  platformColors: PlatformColor[] | undefined;
  selectedColors: string[];
  onSelectedColorsChange: (colors: string[]) => void;
  selectedSizes: string[];
  onSelectedSizesChange: (sizes: string[]) => void;
  stockMatrix: StockMatrix;
  onStockMatrixChange: (matrix: StockMatrix) => void;
}

function cellClass(stock: number): string {
  if (stock === 0) {
    return "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800";
  }
  if (stock <= 5) {
    return "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800";
  }
  return "";
}

function stockInputClass(stock: number): string {
  if (stock === 0) {
    return "border-red-300 dark:border-red-700 focus-visible:ring-red-400";
  }
  if (stock <= 5) {
    return "border-amber-300 dark:border-amber-700 focus-visible:ring-amber-400";
  }
  return "";
}

function stockOf(cell: StockCell | undefined) {
  return cell?.stock ?? 0;
}

function normalizeSizeName(name: string) {
  return name.trim().toLowerCase();
}

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
  const sizeByKey = new Map(
    (platformSizes ?? []).map((size) => [String(size._id), size]),
  );

  function getSizeLabel(sizeKey: string) {
    return sizeByKey.get(sizeKey)?.name ?? sizeKey;
  }

  function toggleColor(colorName: string) {
    if (selectedColors.includes(colorName)) {
      if (selectedColors.length <= 1) return;
      onSelectedColorsChange(selectedColors.filter((c) => c !== colorName));
      const next = { ...stockMatrix };
      delete next[colorName];
      onStockMatrixChange(next);
    } else {
      onSelectedColorsChange([...selectedColors, colorName]);
      const next = { ...stockMatrix };
      next[colorName] = {};
      for (const sizeKey of selectedSizes) {
        next[colorName][sizeKey] = { stock: 0 };
      }
      onStockMatrixChange(next);
    }
  }

  function toggleSize(sizeKey: string) {
    if (selectedSizes.includes(sizeKey)) {
      if (selectedSizes.length <= 1) return;
      onSelectedSizesChange(selectedSizes.filter((s) => s !== sizeKey));
      const next: StockMatrix = {};
      for (const color of selectedColors) {
        next[color] = { ...(stockMatrix[color] ?? {}) };
        delete next[color][sizeKey];
      }
      onStockMatrixChange(next);
    } else {
      onSelectedSizesChange([...selectedSizes, sizeKey]);
      const next: StockMatrix = {};
      for (const color of selectedColors) {
        next[color] = { ...(stockMatrix[color] ?? {}) };
        next[color][sizeKey] = { stock: 0 };
      }
      onStockMatrixChange(next);
    }
  }

  function setStock(colorName: string, sizeKey: string, value: number) {
    const next: StockMatrix = {};
    for (const color of selectedColors) {
      next[color] = { ...(stockMatrix[color] ?? {}) };
    }
    const previous = next[colorName]?.[sizeKey];
    if (!next[colorName]) next[colorName] = {};
    next[colorName][sizeKey] = {
      ...previous,
      stock: value,
    };
    onStockMatrixChange(next);
  }

  const rowTotals: Record<string, number> = {};
  for (const color of selectedColors) {
    rowTotals[color] = selectedSizes.reduce(
      (sum, sizeKey) => sum + stockOf(stockMatrix[color]?.[sizeKey]),
      0,
    );
  }

  const colTotals: Record<string, number> = {};
  for (const sizeKey of selectedSizes) {
    colTotals[sizeKey] = selectedColors.reduce(
      (sum, color) => sum + stockOf(stockMatrix[color]?.[sizeKey]),
      0,
    );
  }

  const grandTotal = Object.values(rowTotals).reduce((sum, value) => sum + value, 0);
  const totalVariants = selectedColors.length * selectedSizes.length;
  const zeroStockCount = selectedColors.reduce(
    (sum, color) =>
      sum +
      selectedSizes.filter(
        (sizeKey) => stockOf(stockMatrix[color]?.[sizeKey]) === 0,
      ).length,
    0,
  );

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
            {noColors && noSizes
              ? "colors and sizes"
              : noColors
                ? "colors"
                : "sizes"}{" "}
            first.
          </p>
        </div>
      </div>
    );
  }

  if (sizesLoading || colorsLoading) {
    return <p className="text-sm text-muted-foreground">Loading colors and sizes...</p>;
  }

  return (
    <div className="space-y-5">
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
                  isLast && "opacity-50 cursor-not-allowed",
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

      <div className="space-y-2">
        <p className="text-sm font-medium">Sizes</p>
        <div className="flex flex-wrap gap-2">
          {platformSizes.map((size) => {
            const sizeKey = String(size._id);
            const active = selectedSizes.includes(sizeKey);
            const isLast = active && selectedSizes.length === 1;
            return (
              <button
                key={size._id}
                type="button"
                title={size.name}
                disabled={isLast}
                onClick={() => toggleSize(sizeKey)}
                className={cn(
                  "rounded-full border px-3 py-1 text-sm font-medium transition-colors",
                  active
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-background text-muted-foreground hover:text-foreground hover:border-foreground",
                  isLast && "opacity-50 cursor-not-allowed",
                )}
              >
                <span className="max-w-[100px] truncate">{size.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {selectedColors.length > 0 && selectedSizes.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-medium">Stock</p>
          <div className="overflow-x-auto rounded-md border">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground w-32">
                    Color
                  </th>
                  {selectedSizes.map((sizeKey) => (
                    <th
                      key={sizeKey}
                      className="px-2 py-2 text-center font-medium min-w-[80px]"
                    >
                      <span
                        className="max-w-[80px] truncate block"
                        title={getSizeLabel(sizeKey)}
                      >
                        {getSizeLabel(sizeKey)}
                      </span>
                    </th>
                  ))}
                  <th className="px-3 py-2 text-center font-medium text-muted-foreground">
                    Total
                  </th>
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
                      {selectedSizes.map((sizeKey) => {
                        const cell = stockMatrix[colorName]?.[sizeKey];
                        const stock = stockOf(cell);
                        return (
                          <td key={sizeKey} className={cn("px-2 py-1.5", cellClass(stock))}>
                            <Input
                              type="number"
                              min="0"
                              step="1"
                              value={stock}
                              onChange={(event) =>
                                setStock(
                                  colorName,
                                  sizeKey,
                                  Math.max(0, parseInt(event.target.value) || 0),
                                )
                              }
                              className={cn(
                                "h-8 w-16 text-center text-xs px-1",
                                stockInputClass(stock),
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
                <tr className="bg-muted/50 border-t">
                  <td className="px-3 py-2 font-medium text-muted-foreground text-xs">
                    Total
                  </td>
                  {selectedSizes.map((sizeKey) => (
                    <td
                      key={sizeKey}
                      className="px-2 py-2 text-center font-medium text-muted-foreground"
                    >
                      {colTotals[sizeKey] ?? 0}
                    </td>
                  ))}
                  <td className="px-3 py-2 text-center font-bold">{grandTotal}</td>
                </tr>
              </tbody>
            </table>
          </div>

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

export function matrixToVariants(
  stockMatrix: StockMatrix,
  selectedColors: string[],
  selectedSizes: string[],
  platformSizes: PlatformSize[],
): VariantEntry[] {
  const sizeByKey = new Map(platformSizes.map((size) => [String(size._id), size]));
  const variants: VariantEntry[] = [];

  for (const color of selectedColors) {
    for (const sizeKey of selectedSizes) {
      const size = sizeByKey.get(sizeKey);
      if (!size) continue;
      const cell = stockMatrix[color]?.[sizeKey];
      variants.push({
        id: cell?.variantId,
        color,
        sizeId: size._id,
        size: size.name,
        stock: stockOf(cell),
      });
    }
  }

  return variants;
}

export function variantsToMatrix(
  variants: {
    _id?: Id<"productVariants">;
    id?: Id<"productVariants">;
    sizeId?: Id<"platformSizes">;
    size: string;
    color?: string;
    stock: number;
  }[],
  platformSizes: PlatformSize[],
): {
  selectedColors: string[];
  selectedSizes: string[];
  stockMatrix: StockMatrix;
} {
  const colorsSet = new Set<string>();
  const sizesSet = new Set<string>();
  const matrix: StockMatrix = {};
  const sizeById = new Map(platformSizes.map((size) => [String(size._id), size]));
  const sizeByName = new Map(
    platformSizes.map((size) => [normalizeSizeName(size.name), size]),
  );

  for (const variant of variants) {
    const size =
      (variant.sizeId ? sizeById.get(String(variant.sizeId)) : null) ??
      sizeByName.get(normalizeSizeName(variant.size));
    if (!size) continue;

    const color = variant.color ?? "__no_color__";
    const sizeKey = String(size._id);
    colorsSet.add(color);
    sizesSet.add(sizeKey);
    if (!matrix[color]) matrix[color] = {};
    matrix[color][sizeKey] = {
      stock: variant.stock,
      variantId: variant.id ?? variant._id,
    };
  }

  return {
    selectedColors: Array.from(colorsSet),
    selectedSizes: Array.from(sizesSet),
    stockMatrix: matrix,
  };
}
