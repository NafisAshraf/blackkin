import { Doc } from "../_generated/dataModel";
import { r2 } from "../r2";

type MediaItem = { storageId: string; type: string; sortOrder: number };

/**
 * Resolve the first image URL (by sortOrder) for each color in variantMedia.
 * If a color has no images of its own, falls back to the first image in commonMediaTop.
 */
export async function resolveColorFirstImageUrls(
  variantMedia: NonNullable<Doc<"products">["variantMedia"]>,
  commonMediaTop: MediaItem[] = [],
): Promise<Array<{ color: string; url: string | null }>> {
  // Pre-resolve the first common-top image URL (used as fallback)
  const firstCommonTopImage = [...commonMediaTop]
    .filter((m) => m.type === "image")
    .sort((a, b) => a.sortOrder - b.sortOrder)[0];
  const commonTopFallbackUrl = firstCommonTopImage
    ? await r2.getUrl(firstCommonTopImage.storageId)
    : null;

  return Promise.all(
    variantMedia.map(async (entry) => {
      const firstImage = [...entry.media]
        .filter((m) => m.type === "image")
        .sort((a, b) => a.sortOrder - b.sortOrder)[0];
      const url = firstImage
        ? await r2.getUrl(firstImage.storageId)
        : commonTopFallbackUrl;
      return { color: entry.color, url };
    }),
  );
}
