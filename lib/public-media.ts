const configuredBaseUrl = process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL?.replace(
  /\/+$/,
  "",
);

function encodeStorageKey(storageId: string) {
  return storageId
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
}

/**
 * Storefront pages must never embed expiring R2 signatures. In production the
 * URL points directly at the public R2 custom domain. The local fallback keeps
 * development usable until that domain is configured.
 */
export function getPublicMediaUrl(storageId?: string | null) {
  if (!storageId) return null;
  const encodedKey = encodeStorageKey(storageId);
  return configuredBaseUrl
    ? `${configuredBaseUrl}/${encodedKey}`
    : `/api/media/${encodedKey}`;
}

export function hasPublicMediaDomain() {
  return Boolean(configuredBaseUrl);
}
