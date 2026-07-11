"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";

interface LazyVideoProps {
  src: string;
  className?: string;
  style?: CSSProperties;
  priority?: boolean;
  poster?: string;
}

export function LazyVideo({
  src,
  className,
  style,
  priority = false,
  poster,
}: LazyVideoProps) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [shouldLoad, setShouldLoad] = useState(priority);

  useEffect(() => {
    if (priority || shouldLoad) return;
    const target = wrapperRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShouldLoad(true);
          observer.disconnect();
        }
      },
      { rootMargin: "600px 0px" },
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [priority, shouldLoad]);

  useEffect(() => {
    if (!shouldLoad) return;
    const video = videoRef.current;
    if (!video) return;
    video.play().catch(() => {
      // Autoplay can be blocked on some devices; poster/first frame still shows.
    });
  }, [shouldLoad]);

  return (
    <div ref={wrapperRef} className="h-full w-full bg-muted">
      <video
        ref={videoRef}
        src={shouldLoad ? src : undefined}
        autoPlay={shouldLoad}
        loop
        muted
        playsInline
        disablePictureInPicture
        controls={false}
        preload={priority ? "metadata" : "none"}
        poster={poster}
        className={className}
        style={style}
        {...{ "webkit-playsinline": "true" }}
      />
    </div>
  );
}
