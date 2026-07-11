export type StorefrontRevalidationScope =
  | { scope: "home" }
  | { scope: "catalog" }
  | { scope: "product"; slug: string }
  | { scope: "all" };

/** Best-effort cache refresh. The 15-minute ISR window remains the fallback. */
export async function requestStorefrontRevalidation(
  request: StorefrontRevalidationScope,
) {
  const response = await fetch("/api/storefront/revalidate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error("Storefront cache refresh failed");
  }
}
