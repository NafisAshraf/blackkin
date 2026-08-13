"use client";

import { useCallback } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { authClient } from "@/lib/auth-client";
import {
  createMetaEventId,
  getMetaBrowserIdentifiers,
  MetaEventParameters,
  trackMetaEvent,
} from "@/lib/meta-pixel";

type ServerEventName = "AddToCart" | "InitiateCheckout";

function eventPrefix(eventName: string) {
  return eventName.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
}

export function useMetaTracking() {
  const { data: session } = authClient.useSession();
  const enqueueClientEvent = useMutation(
    api.marketingEvents.enqueueClientEvent,
  );

  const trackEcommerceEvent = useCallback(
    (eventName: ServerEventName, parameters: MetaEventParameters) => {
      const eventId = createMetaEventId(eventPrefix(eventName));
      const eventTime = Math.floor(Date.now() / 1000);
      trackMetaEvent(eventName, parameters, eventId);

      // Only authenticated events get a best-effort CAPI copy. This call is
      // deliberately not awaited so Meta can never delay cart or checkout.
      if (session) {
        const identifiers = getMetaBrowserIdentifiers();
        void enqueueClientEvent({
          eventName,
          eventId,
          eventTime,
          sourceUrl: window.location.href,
          ...(parameters.value !== undefined
            ? { value: parameters.value }
            : {}),
          ...(parameters.currency ? { currency: parameters.currency } : {}),
          ...(parameters.content_ids
            ? { contentIds: parameters.content_ids }
            : {}),
          ...(parameters.contents
            ? {
                contents: parameters.contents.map((content) => ({
                  id: content.id,
                  quantity: content.quantity,
                  ...(content.item_price !== undefined
                    ? { itemPrice: content.item_price }
                    : {}),
                })),
              }
            : {}),
          ...(parameters.num_items !== undefined
            ? { numItems: parameters.num_items }
            : {}),
          ...identifiers,
        }).catch(() => {});
      }

      return eventId;
    },
    [enqueueClientEvent, session],
  );

  const trackAddToCart = useCallback(
    (parameters: MetaEventParameters) =>
      trackEcommerceEvent("AddToCart", parameters),
    [trackEcommerceEvent],
  );

  const trackInitiateCheckout = useCallback(
    (parameters: MetaEventParameters) =>
      trackEcommerceEvent("InitiateCheckout", parameters),
    [trackEcommerceEvent],
  );

  return { trackAddToCart, trackInitiateCheckout };
}
