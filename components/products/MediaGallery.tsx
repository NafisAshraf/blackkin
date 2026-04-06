"use client";

import { useState, useCallback, useEffect } from "react";
import useEmblaCarousel from "embla-carousel-react";
import dynamic from "next/dynamic";
import { ChevronLeft, ChevronRight } from "lucide-react";

const ModelViewer = dynamic(() => import("./ModelViewer"), { ssr: false });

interface MediaItem {
  storageId: string;
  type: "image" | "video" | "model3d";
  sortOrder: number;
  url: string | null;
}

interface MediaGalleryProps {
  media: MediaItem[];
}

export default function MediaGallery({ media }: MediaGalleryProps) {
  const sorted = [...media].sort((a, b) => a.sortOrder - b.sortOrder);
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: false });
  const [currentIndex, setCurrentIndex] = useState(0);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setCurrentIndex(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    emblaApi.on("select", onSelect);
    return () => {
      emblaApi.off("select", onSelect);
    };
  }, [emblaApi, onSelect]);

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);

  if (sorted.length === 0) {
    return (
      <div className="w-full aspect-[4/5] bg-muted flex items-center justify-center">
        <span className="text-muted-foreground text-sm">No media</span>
      </div>
    );
  }

  const currentItem = sorted[currentIndex];
  const is3DSlide = currentItem?.type === "model3d";

  return (
    <div className="relative w-full select-none">
      <div ref={emblaRef} className="overflow-hidden">
        <div className="flex">
          {sorted.map((item, index) => (
            <div
              key={item.storageId}
              className="flex-[0_0_100%] min-w-0 aspect-[4/5] relative bg-muted"
            >
              {!item.url ? (
                <div className="w-full h-full flex items-center justify-center">
                  <span className="text-muted-foreground text-sm">No media</span>
                </div>
              ) : item.type === "image" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.url}
                  alt={`Product media ${index + 1}`}
                  className="w-full h-full object-cover"
                />
              ) : item.type === "video" ? (
                <video
                  src={item.url}
                  controls
                  controlsList="nodownload nofullscreen noremoteplayback"
                  disablePictureInPicture
                  playsInline
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full">
                  <ModelViewer url={item.url} />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* L/R arrows — shown only on the 3D slide (touch consumed by OrbitControls) */}
      {is3DSlide && (
        <>
          <button
            type="button"
            onClick={scrollPrev}
            className="absolute left-3 top-1/2 -translate-y-1/2 z-10 bg-black/60 text-white rounded-full p-2 hover:bg-black/80 transition-colors"
            aria-label="Previous"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={scrollNext}
            className="absolute right-3 top-1/2 -translate-y-1/2 z-10 bg-black/60 text-white rounded-full p-2 hover:bg-black/80 transition-colors"
            aria-label="Next"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </>
      )}

      {/* Dot navigation — clickable, bottom center */}
      {sorted.length > 1 && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
          {sorted.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => emblaApi?.scrollTo(i)}
              className={`w-1.5 h-1.5 rounded-full transition-colors ${
                i === currentIndex ? "bg-white" : "bg-white/50"
              }`}
              aria-label={`Go to slide ${i + 1}`}
            />
          ))}
        </div>
      )}

      {/* Counter — top right */}
      {sorted.length > 1 && (
        <div className="absolute top-3 right-3 bg-black/60 text-white text-xs px-2.5 py-1 rounded z-10">
          {currentIndex + 1}/{sorted.length}
        </div>
      )}
    </div>
  );
}
