"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

export interface CarouselItem {
  _id: string;
  imageUrl: string;
  text: string;
}

interface TechnologyCarouselProps {
  carousels: CarouselItem[];
}

export function TechnologyCarousel({ carousels }: TechnologyCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  const next = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % carousels.length);
  }, [carousels.length]);

  const prev = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + carousels.length) % carousels.length);
  }, [carousels.length]);

  useEffect(() => {
    if (carousels.length <= 1 || isHovered) return;
    const interval = setInterval(next, 3000);
    return () => clearInterval(interval);
  }, [next, carousels.length, isHovered]);

  if (!carousels || carousels.length === 0) return null;

  const getPosition = (index: number) => {
    const diff = index - currentIndex;
    const len = carousels.length;
    let offset = diff;

    // Handle wrapping for infinite feel
    if (Math.abs(diff) > len / 2) {
      if (diff > 0) offset -= len;
      else offset += len;
    }

    if (offset === 0) return "center";
    if (offset === -1) return "left";
    if (offset === 1) return "right";
    if (offset === -2) return "farLeft";
    if (offset === 2) return "farRight";
    if (offset < -2) return "leftHidden";
    if (offset > 2) return "rightHidden";
    return "rightHidden";
  };

  const variants = {
    center: {
      x: "0%",
      scale: 1.3,
      zIndex: 5,
      opacity: 1,
      originY: 1,
    },
    left: {
      x: "-122.5%",
      scale: 0.9,
      zIndex: 4,
      opacity: 1,
      originY: 1,
    },
    right: {
      x: "122.5%",
      scale: 0.9,
      zIndex: 4,
      opacity: 1,
      originY: 1,
    },
    farLeft: {
      x: "-225%",
      scale: 0.9,
      zIndex: 3,
      opacity: 1,
      originY: 1,
    },
    farRight: {
      x: "225%",
      scale: 0.9,
      zIndex: 3,
      opacity: 1,
      originY: 1,
    },
    leftHidden: {
      x: "-390%",
      scale: 0.5,
      zIndex: 1,
      opacity: 0,
      originY: 1,
    },
    rightHidden: {
      x: "390%",
      scale: 0.5,
      zIndex: 1,
      opacity: 0,
      originY: 1,
    },
  };

  return (
    <section className="w-full bg-white overflow-hidden relative pb-40 pt-60">
      <div
        className="relative w-full h-[75vh] flex items-end justify-center "
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {carousels.map((item, index) => {
          const position = getPosition(index);
          const isCenter = position === "center";

          return (
            <motion.div
              key={item._id}
              className="absolute w-[60%] sm:w-[40%] md:w-[25%] lg:w-[20%] aspect-[3/4] cursor-pointer bottom-20"
              variants={variants}
              initial="center"
              animate={position}
              transition={{ duration: 0.6, ease: [0.32, 0.72, 0, 1] }}
              onClick={() => {
                if (!isCenter) setCurrentIndex(index);
              }}
            >
              <div className="w-full h-full rounded-2xl overflow-hidden shadow-2xl relative ">
                <img
                  src={item.imageUrl}
                  alt={item.text}
                  className="w-full h-full object-cover"
                />
              </div>

              <AnimatePresence>
                {isCenter && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    transition={{ duration: 0.4, delay: 0.2 }}
                    className="absolute -bottom-16 left-0 right-0 text-center"
                  >
                    <p className="text-sm md:text-base text-foreground font-medium tracking-wide">
                      {item.text}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}

        {/* Navigation Buttons Removed */}
      </div>

      <div className="flex justify-center mt-8">
        <Link
          href="/products"
          className="text-xs md:text-sm font-semibold tracking-widest uppercase bg-[#1a1a1a] text-white px-8 py-3.5 hover:bg-black transition-colors"
        >
          View All Products
        </Link>
      </div>
    </section>
  );
}
