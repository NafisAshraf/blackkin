export type MetaStandardEvent =
  | "PageView"
  | "ViewContent"
  | "Search"
  | "AddToWishlist"
  | "AddToCart"
  | "InitiateCheckout"
  | "Purchase";

export interface MetaContent {
  id: string;
  quantity: number;
  item_price?: number;
}

export interface MetaEventParameters {
  content_ids?: string[];
  content_name?: string;
  content_type?: "product";
  contents?: MetaContent[];
  currency?: "BDT";
  num_items?: number;
  order_id?: string;
  search_string?: string;
  value?: number;
}

type MetaPixelFunction = (...args: unknown[]) => void;

declare global {
  interface Window {
    fbq?: MetaPixelFunction;
  }
}

export function createMetaEventId(prefix: string): string {
  const suffix =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${suffix}`;
}

export function trackMetaEvent(
  eventName: MetaStandardEvent,
  parameters: MetaEventParameters = {},
  eventId?: string,
): void {
  if (typeof window === "undefined" || typeof window.fbq !== "function") {
    return;
  }

  try {
    if (eventId) {
      window.fbq("track", eventName, parameters, { eventID: eventId });
    } else {
      window.fbq("track", eventName, parameters);
    }
  } catch {
    // Analytics must never interrupt customer-facing actions.
  }
}

export function trackMetaCustomEvent(
  eventName: string,
  parameters: Record<string, string | number | boolean> = {},
): void {
  if (typeof window === "undefined" || typeof window.fbq !== "function") {
    return;
  }

  try {
    window.fbq("trackCustom", eventName, parameters);
  } catch {
    // Analytics must never interrupt authentication or navigation.
  }
}

export function getMetaBrowserIdentifiers(): {
  fbp?: string;
  fbc?: string;
} {
  if (typeof document === "undefined") return {};

  const cookies = Object.fromEntries(
    document.cookie.split(";").flatMap((part) => {
      const separator = part.indexOf("=");
      if (separator === -1) return [];
      return [
        [
          decodeURIComponent(part.slice(0, separator).trim()),
          decodeURIComponent(part.slice(separator + 1).trim()),
        ],
      ];
    }),
  );

  return {
    ...(cookies._fbp ? { fbp: cookies._fbp } : {}),
    ...(cookies._fbc ? { fbc: cookies._fbc } : {}),
  };
}
