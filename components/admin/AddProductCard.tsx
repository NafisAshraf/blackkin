"use client";

import Link from "next/link";
import { PlusCircle } from "lucide-react";

interface AddProductCardProps {
  href: string;
  label?: string;
}

export function AddProductCard({ href, label = "Add Product" }: AddProductCardProps) {
  return (
    <Link
      href={href}
      className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted/20 hover:border-muted-foreground/60 hover:bg-muted/40 transition-colors aspect-square cursor-pointer group"
    >
      <PlusCircle className="h-8 w-8 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors" />
      <span className="text-xs text-muted-foreground/70 group-hover:text-muted-foreground transition-colors font-medium">
        {label}
      </span>
    </Link>
  );
}
