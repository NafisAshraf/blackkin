"use client";

import { useEffect, useRef, useState } from "react";
import {
  pushUrlSearchParams,
  useUrlSearchParams,
} from "@/hooks/use-url-search-params";
import { Input } from "@/components/ui/input";
import { Search, X } from "lucide-react";

interface SearchBarProps {
  defaultValue?: string;
  placeholder?: string;
}

export default function SearchBar({ defaultValue = "", placeholder = "Search products..." }: SearchBarProps) {
  const searchParams = useUrlSearchParams();
  const [value, setValue] = useState(defaultValue);
  const searchParamsRef = useRef(searchParams);
  searchParamsRef.current = searchParams;

  useEffect(() => {
    setValue(defaultValue);
  }, [defaultValue]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const current = searchParamsRef.current;
      const currentQ = current.get("q") ?? "";
      if (value === currentQ) return;
      const params = new URLSearchParams(current.toString());
      if (value) {
        params.set("q", value);
      } else {
        params.delete("q");
      }
      pushUrlSearchParams(params);
    }, 300);
    return () => clearTimeout(timer);
  }, [value]);

  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="pl-9 pr-9"
      />
      {value && (
        <button
          type="button"
          onClick={() => setValue("")}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
