"use client";

import { useState, useRef, useEffect, useCallback } from "react";

interface MediaItem {
  storageId: string;
  type: "image" | "video";
  sortOrder: number;
  url: string | null;
}

interface MediaGalleryProps {
  media: MediaItem[];
}

// Desktop: stacked images (parent handles sticky scroll)
function DesktopGallery({ sorted }: { sorted: MediaItem[] }) {
  if (sorted.length === 0) {
    return (
      <div className="aspect-[4/5] bg-muted flex items-center justify-center">
        <span className="text-muted-foreground text-sm">No image</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0.5">
      {sorted.map((item, index) =>
        item.url ? (
          item.type === "video" ? (
            <video
              key={item.storageId}
              src={item.url}
              controls
              className="w-full aspect-[4/5] object-cover bg-muted"
            />
          ) : (
            <img
              key={item.storageId}
              src={item.url}
              alt={`Product image ${index + 1}`}
              className="w-full aspect-[4/5] object-cover bg-muted"
            />
          )
        ) : (
          <div
            key={item.storageId}
            className="w-full aspect-[4/5] bg-muted flex items-center justify-center"
          >
            <span className="text-muted-foreground text-sm">No image</span>
          </div>
        )
      )}
    </div>
  );
}

// Mobile: swipeable slider with counter
function MobileGallery({ sorted }: { sorted: MediaItem[] }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const sliderRef = useRef<HTMLDivElement>(null);

  const handleScroll = useCallback(() => {
    const el = sliderRef.current;
    if (!el) return;
    const scrollLeft = el.scrollLeft;
    const width = el.offsetWidth;
    const idx = Math.round(scrollLeft / width);
    setCurrentIndex(idx);
  }, []);

  if (sorted.length === 0) {
    return (
      <div className="aspect-square bg-muted flex items-center justify-center">
        <span className="text-muted-foreground text-sm">No image</span>
      </div>
    );
  }

  return (
    <div className="relative">
      <div
        ref={sliderRef}
        className="mobile-slider"
        onScroll={handleScroll}
        style={{ height: "75vw", maxHeight: "420px" }}
      >
        {sorted.map((item, index) =>
          item.url ? (
            item.type === "video" ? (
              <video
                key={item.storageId}
                src={item.url}
                controls
                className="w-full h-full object-cover flex-shrink-0 bg-muted"
                style={{ minWidth: "100%", scrollSnapAlign: "start" }}
              />
            ) : (
              <img
                key={item.storageId}
                src={item.url}
                alt={`Product image ${index + 1}`}
                className="w-full h-full object-cover flex-shrink-0 bg-muted"
                style={{ minWidth: "100%", scrollSnapAlign: "start" }}
              />
            )
          ) : (
            <div
              key={item.storageId}
              className="flex-shrink-0 w-full h-full bg-muted flex items-center justify-center"
              style={{ minWidth: "100%", scrollSnapAlign: "start" }}
            >
              <span className="text-muted-foreground text-sm">No image</span>
            </div>
          )
        )}
      </div>
      {/* Counter */}
      {sorted.length > 1 && (
        <div className="absolute bottom-3 right-3 bg-black/60 text-white text-xs px-2.5 py-1 rounded">
          {currentIndex + 1}/{sorted.length}
        </div>
      )}
    </div>
  );
}

export default function MediaGallery({ media }: MediaGalleryProps) {
  const sorted = [...media].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <>
      {/* Desktop */}
      <div className="hidden md:block">
        <DesktopGallery sorted={sorted} />
      </div>
      {/* Mobile */}
      <div className="md:hidden">
        <MobileGallery sorted={sorted} />
      </div>
    </>
  );
}
