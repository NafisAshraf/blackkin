import { Doc } from "../_generated/dataModel";
import { r2 } from "../r2";

/** Resolve the first image URL (by sortOrder) for each color in variantMedia. */
export async function resolveColorFirstImageUrls(
  variantMedia: NonNullable<Doc<"products">["variantMedia"]>,
): Promise<Array<{ color: string; url: string | null }>> {
  return Promise.all(
    variantMedia.map(async (entry) => {
      const firstImage = [...entry.media]
        .filter((m) => m.type === "image")
        .sort((a, b) => a.sortOrder - b.sortOrder)[0];
      const url = firstImage ? await r2.getUrl(firstImage.storageId) : null;
      return { color: entry.color, url };
    }),
  );
}
