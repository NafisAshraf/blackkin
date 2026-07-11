import { getPublicMediaUrl } from "@/lib/public-media";

type StorageBackedProductCard = {
  thumbnailStorageId?: string | null;
  hoverThumbnailStorageId?: string | null;
  colorFirstImageStorageIds?: Array<{
    color: string;
    storageId: string | null;
  }>;
};

export function resolveProductCardMedia<T extends StorageBackedProductCard>(
  product: T,
) {
  return {
    ...product,
    imageUrl: getPublicMediaUrl(product.thumbnailStorageId),
    hoverImageUrl: getPublicMediaUrl(product.hoverThumbnailStorageId),
    colorFirstImageUrls: (product.colorFirstImageStorageIds ?? []).map(
      (item) => ({
        color: item.color,
        url: getPublicMediaUrl(item.storageId),
      }),
    ),
  };
}
