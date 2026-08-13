import { v } from "convex/values";
import {
  internalMutation,
  internalQuery,
  mutation,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { requireAuth } from "./lib/auth.helpers";
import { enqueueMarketingEvent } from "./lib/marketingEvents";

const eventNameValidator = v.union(
  v.literal("AddToCart"),
  v.literal("InitiateCheckout"),
);

const contentsValidator = v.array(
  v.object({
    id: v.string(),
    quantity: v.number(),
    itemPrice: v.optional(v.number()),
  }),
);

export const enqueueClientEvent = mutation({
  args: {
    eventName: eventNameValidator,
    eventId: v.string(),
    eventTime: v.number(),
    sourceUrl: v.optional(v.string()),
    value: v.optional(v.number()),
    currency: v.optional(v.string()),
    contentIds: v.optional(v.array(v.string())),
    contents: v.optional(contentsValidator),
    numItems: v.optional(v.number()),
    fbp: v.optional(v.string()),
    fbc: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    await enqueueMarketingEvent(ctx, {
      ...args,
      userId: user._id,
    });
    return null;
  },
});

export const getDeliveryPayload = internalQuery({
  args: { outboxId: v.id("marketingEventOutbox") },
  handler: async (ctx, args) => {
    const event = await ctx.db.get(args.outboxId);
    if (!event || event.status !== "pending") return null;

    const [settings, user] = await Promise.all([
      ctx.db
        .query("marketingSettings")
        .withIndex("by_type", (q) => q.eq("type", "facebook"))
        .unique(),
      ctx.db.get(event.userId),
    ]);

    const config = settings?.config as
      | {
          pixelId?: string;
          accessToken?: string;
          testEventCode?: string;
          serverEnabled?: boolean;
        }
      | undefined;

    return {
      event,
      user: user
        ? {
            id: String(user._id),
            email: user.email,
            phone: user.phone,
          }
        : null,
      config: {
        pixelId: config?.pixelId,
        accessToken: config?.accessToken,
        testEventCode: config?.testEventCode,
        serverEnabled: config?.serverEnabled ?? false,
      },
    };
  },
});

export const markDelivered = internalMutation({
  args: { outboxId: v.id("marketingEventOutbox") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const event = await ctx.db.get(args.outboxId);
    if (!event || event.status !== "pending") return null;
    await ctx.db.patch(event._id, {
      status: "sent",
      attempts: event.attempts + 1,
      sentAt: Date.now(),
      lastError: undefined,
    });
    return null;
  },
});

export const markDeliveryFailed = internalMutation({
  args: {
    outboxId: v.id("marketingEventOutbox"),
    reason: v.string(),
    terminal: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const event = await ctx.db.get(args.outboxId);
    if (!event || event.status !== "pending") return null;

    const attempts = event.attempts + 1;
    const terminal = args.terminal === true || attempts >= 4;
    if (terminal) {
      await ctx.db.patch(event._id, {
        status: "failed",
        attempts,
        lastError: args.reason.slice(0, 300),
      });
      return null;
    }

    const retryDelaysMs = [60_000, 300_000, 1_800_000];
    const delay = retryDelaysMs[Math.min(attempts - 1, retryDelaysMs.length - 1)];
    await ctx.db.patch(event._id, {
      attempts,
      nextAttemptAt: Date.now() + delay,
      lastError: args.reason.slice(0, 300),
    });
    await ctx.scheduler.runAfter(
      delay,
      internal.marketingActions.deliverFacebookEvent,
      { outboxId: event._id },
    );
    return null;
  },
});
