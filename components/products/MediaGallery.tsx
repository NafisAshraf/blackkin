"use client";

import { useState, useCallback, useEffect, useId } from "react";
import useEmblaCarousel from "embla-carousel-react";
import dynamic from "next/dynamic";
import { cn } from "@/lib/utils";
import { Play, Box } from "lucide-react";

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
  const imagesOnly = sorted.filter((m) => m.type === "image");
  const [isHovered, setIsHovered] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const baseId = useId();

  // Mobile carousel state
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: false });
  const [currentIndex, setCurrentIndex] = useState(0);
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setCurrentIndex(emblaApi.selectedScrollSnap());
    setCanScrollPrev(emblaApi.canScrollPrev());
    setCanScrollNext(emblaApi.canScrollNext());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    
    // Initial state check
    onSelect();
    
    emblaApi.on("reInit", onSelect);
    emblaApi.on("select", onSelect);
    
    return () => {
      emblaApi.off("select", onSelect);
      emblaApi.off("reInit", onSelect);
    };
  }, [emblaApi, onSelect]);

  // Track active media item on scroll
  useEffect(() => {
    const observerOptions = {
      root: null,
      rootMargin: "-70px 0px -50% 0px", // Includes the 80px scroll point
      threshold: [0, 0.5],
    };

    const observerCallback = (entries: IntersectionObserverEntry[]) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const idParts = entry.target.id.split("-");
          const index = parseInt(idParts[idParts.length - 1]);
          if (!isNaN(index)) {
            setActiveIndex(index);
          }
        }
      });
    };

    const observer = new IntersectionObserver(observerCallback, observerOptions);
    sorted.forEach((_, i) => {
      const el = document.getElementById(`${baseId}-media-${i}`);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [sorted]);

  const scrollToMedia = (index: number) => {
    setActiveIndex(index);
    const element = document.getElementById(`${baseId}-media-${index}`);
    if (element) {
      element.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  };

  if (sorted.length === 0) {
    return (
      <div className="w-full aspect-[3/4] bg-muted flex items-center justify-center">
        <span className="text-muted-foreground text-sm">No media</span>
      </div>
    );
  }

  const total = imagesOnly.length;

  return (
    <>
      {/* ── MOBILE: Horizontal Embla slider (images only) ─── */}
      <div className="lg:hidden group relative">
        {imagesOnly.length === 0 ? (
          <div className="w-full aspect-[3/4] bg-muted" />
        ) : (
          <div>
            <div className="relative">
              <div ref={emblaRef} className="overflow-hidden">
                <div className="flex">
                  {imagesOnly.map((item, i) => (
                    <div
                      key={item.storageId}
                      className="flex-[0_0_100%] aspect-[3/4] bg-muted overflow-hidden"
                    >
                      {item.url && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.url}
                          alt={`Product ${i + 1}`}
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Navigation Arrows (visible on hover) */}
              {total > 1 && (
                <>
                  <button
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center bg-white/80 hover:bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-0 disabled:pointer-events-none text-black shadow-sm z-10"
                    onClick={() => emblaApi?.scrollPrev()}
                    disabled={!canScrollPrev}
                    aria-label="Previous image"
                  >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                  </button>
                  <button
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center bg-white/80 hover:bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-0 disabled:pointer-events-none text-black shadow-sm z-10"
                    onClick={() => emblaApi?.scrollNext()}
                    disabled={!canScrollNext}
                    aria-label="Next image"
                  >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                  </button>
                </>
              )}
            </div>

            {/* Counter & Progress bar — below image */}
            {total > 1 && (
              <div className="px-5 pt-3 pb-2 flex flex-col gap-2">
                <div className="text-sm font-medium text-foreground tracking-wide">
                  {currentIndex + 1}/{total}
                </div>
                <div className="h-0.5 w-full bg-border relative overflow-hidden">
                  <div
                    className="absolute top-0 left-0 h-full bg-foreground transition-[transform,width] duration-300 ease-out"
                    style={{
                      width: `${100 / total}%`,
                      transform: `translateX(${currentIndex * 100}%)`,
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── DESKTOP: Vertical stack of all media ─────────── */}
      <div
        className="hidden lg:block relative"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Navigation thumbnails — only show if more than 1 item */}
        {sorted.length > 1 && (
          <div
            className={cn(
              "fixed left-8 top-1/2 -translate-y-1/2 z-40 flex items-stretch gap-3 transition-all duration-500 ease-out",
              isHovered
                ? "opacity-100 translate-x-0"
                : "opacity-0 -translate-x-4 pointer-events-none",
            )}
          >
            {/* Thumbnail Column */}
            <div className="flex flex-col gap-3">
              {sorted.map((item, i) => {
                const isActive = activeIndex === i;
                return (
                  <button
                    key={`nav-${item.storageId}`}
                    onClick={() => scrollToMedia(i)}
                    className={cn(
                      "group/thumb relative w-8 aspect-[3/4] bg-muted overflow-hidden border transition-all duration-300",
                      isActive
                        ? "border-foreground/40 scale-110 shadow-sm"
                        : "border-transparent hover:border-foreground/10 opacity-50 hover:opacity-100",
                    )}
                    aria-label={`Go to media ${i + 1}`}
                  >
                    {item.url && item.type === "image" ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.url}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-black/[0.03] text-foreground/60">
                        {item.type === "video" ? (
                          <Play className="w-3 h-3 fill-current" />
                        ) : (
                          <Box className="w-3 h-3" />
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Vertical Indicator Line */}
            <div className="w-[1px] bg-foreground/10 relative">
              <div
                className="absolute w-full bg-foreground/60 transition-all duration-500 ease-in-out"
                style={{
                  height: `${100 / sorted.length}%`,
                  top: `${(activeIndex * 100) / sorted.length}%`,
                }}
              />
            </div>
          </div>
        )}

        {sorted.map((item, i) => (
          <div
            key={item.storageId}
            id={`${baseId}-media-${i}`}
            className="w-full aspect-[3/4] bg-muted overflow-hidden scroll-mt-20"
          >
            {!item.url ? null : item.type === "image" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.url}
                alt={`Product ${i + 1}`}
                className="w-full h-full object-cover hover:scale-105 transition-transform duration-700"
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
    </>
  );
}
