"use node";

import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import * as crypto from "crypto";

function sha256Hash(value: string): string {
  return crypto.createHash("sha256").update(value.toLowerCase().trim()).digest("hex");
}

export const deliverFacebookEvent = internalAction({
  args: { outboxId: v.id("marketingEventOutbox") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const payload = await ctx.runQuery(
      internal.marketingEvents.getDeliveryPayload,
      { outboxId: args.outboxId },
    );
    if (!payload) return null;

    const { event, user, config } = payload;
    if (!config.serverEnabled || !config.pixelId || !config.accessToken) {
      await ctx.runMutation(internal.marketingEvents.markDeliveryFailed, {
        outboxId: args.outboxId,
        reason: "Server-side Meta events are disabled or incomplete",
        terminal: true,
      });
      return null;
    }

    const userData: Record<string, string> = {};
    if (user?.email) userData.em = sha256Hash(user.email);
    if (user?.phone) userData.ph = sha256Hash(user.phone.replace(/\D/g, ""));
    if (user?.id) userData.external_id = sha256Hash(user.id);
    if (event.fbp) userData.fbp = event.fbp;
    if (event.fbc) userData.fbc = event.fbc;

    const eventData: Record<string, unknown> = {
      event_name: event.eventName,
      event_time: event.eventTime,
      event_id: event.eventId,
      action_source: "website",
      user_data: userData,
    };

    if (
      event.value !== undefined ||
      event.contentIds ||
      event.contents ||
      event.orderId
    ) {
      eventData.custom_data = {
        ...(event.value !== undefined
          ? { value: event.value, currency: event.currency ?? "BDT" }
          : {}),
        ...(event.contentIds
          ? { content_ids: event.contentIds, content_type: "product" }
          : {}),
        ...(event.contents
          ? {
              contents: event.contents.map((content) => ({
                id: content.id,
                quantity: content.quantity,
                ...(content.itemPrice !== undefined
                  ? { item_price: content.itemPrice }
                  : {}),
              })),
            }
          : {}),
        ...(event.numItems !== undefined ? { num_items: event.numItems } : {}),
        ...(event.orderId ? { order_id: event.orderId } : {}),
      };
    }

    if (event.sourceUrl) eventData.event_source_url = event.sourceUrl;

    const url = new URL(
      `https://graph.facebook.com/v21.0/${config.pixelId}/events`,
    );
    url.searchParams.set("access_token", config.accessToken);

    try {
      const res = await fetch(url.toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: [eventData],
          ...(config.testEventCode
            ? { test_event_code: config.testEventCode }
            : {}),
        }),
      });
      if (!res.ok) {
        await ctx.runMutation(internal.marketingEvents.markDeliveryFailed, {
          outboxId: args.outboxId,
          reason: `Meta API returned HTTP ${res.status}`,
          terminal: res.status >= 400 && res.status < 500 && res.status !== 429,
        });
        return null;
      }
      await ctx.runMutation(internal.marketingEvents.markDelivered, {
        outboxId: args.outboxId,
      });
    } catch {
      await ctx.runMutation(internal.marketingEvents.markDeliveryFailed, {
        outboxId: args.outboxId,
        reason: "Meta API network request failed",
      });
    }
    return null;
  },
});
