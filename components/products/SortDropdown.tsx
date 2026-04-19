"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const SORT_OPTIONS = [
  { value: "recommended", label: "Recommended" },
  { value: "best_selling", label: "Best Selling" },
  { value: "price_asc", label: "Price: Low to High" },
  { value: "price_desc", label: "Price: High to Low" },
  { value: "newest", label: "Newest" },
] as const;

type SortValue = (typeof SORT_OPTIONS)[number]["value"];

export default function SortDropdown() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const current = (searchParams.get("sortBy") as SortValue) ?? "recommended";
  const currentLabel =
    SORT_OPTIONS.find((o) => o.value === current)?.label ?? "Recommended";

  function handleSelect(value: SortValue) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "recommended") {
      params.delete("sortBy");
    } else {
      params.set("sortBy", value);
    }
    router.push(`?${params.toString()}`);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-1.5 text-xs font-medium border border-border px-3 py-2 hover:bg-muted transition-colors whitespace-nowrap">
          <span>Sort: {currentLabel}</span>
          <ChevronDown className="h-3 w-3 flex-shrink-0" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        {SORT_OPTIONS.map((option) => (
          <DropdownMenuItem
            key={option.value}
            onClick={() => handleSelect(option.value)}
            className={current === option.value ? "font-semibold" : ""}
          >
            {option.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
