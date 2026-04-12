"use node";

import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import * as crypto from "crypto";

function sha256Hash(value: string): string {
  return crypto.createHash("sha256").update(value.toLowerCase().trim()).digest("hex");
}

export const sendFacebookEvent = internalAction({
  args: {
    pixelId: v.string(),
    accessToken: v.string(),
    testEventCode: v.optional(v.string()),
    eventName: v.string(),
    eventId: v.string(),
    eventTime: v.number(),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    value: v.optional(v.number()),
    currency: v.optional(v.string()),
    contentIds: v.optional(v.array(v.string())),
    sourceUrl: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (!args.pixelId || !args.accessToken) return null;

    const userData: Record<string, string> = {};
    if (args.email) userData.em = sha256Hash(args.email);
    if (args.phone) userData.ph = sha256Hash(args.phone.replace(/\D/g, ""));

    const eventData: Record<string, unknown> = {
      event_name: args.eventName,
      event_time: args.eventTime,
      event_id: args.eventId,
      action_source: "website",
      user_data: userData,
    };

    if (args.value !== undefined || args.contentIds) {
      eventData.custom_data = {
        ...(args.value !== undefined ? { value: args.value, currency: args.currency ?? "BDT" } : {}),
        ...(args.contentIds ? { content_ids: args.contentIds, content_type: "product" } : {}),
      };
    }

    if (args.sourceUrl) eventData.event_source_url = args.sourceUrl;

    const url = new URL(`https://graph.facebook.com/v21.0/${args.pixelId}/events`);
    url.searchParams.set("access_token", args.accessToken);
    if (args.testEventCode) url.searchParams.set("test_event_code", args.testEventCode);

    try {
      const res = await fetch(url.toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: [eventData] }),
      });
      if (!res.ok) {
        const body = await res.text();
        console.error("[FB CAPI] error:", res.status, body);
      }
    } catch (err) {
      console.error("[FB CAPI] fetch error:", err);
    }
    return null;
  },
});
