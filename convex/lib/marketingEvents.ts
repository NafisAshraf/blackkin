import { internal } from "../_generated/api";
import { Id } from "../_generated/dataModel";
import { MutationCtx } from "../_generated/server";

export type MarketingEventName =
  | "AddToCart"
  | "InitiateCheckout"
  | "Purchase";

export interface MarketingEventContent {
  id: string;
  quantity: number;
  itemPrice?: number;
}

interface EnqueueMarketingEventArgs {
  eventName: MarketingEventName;
  eventId: string;
  eventTime: number;
  sourceUrl?: string;
  userId: Id<"users">;
  value?: number;
  currency?: string;
  contentIds?: string[];
  contents?: MarketingEventContent[];
  numItems?: number;
  orderId?: string;
  fbp?: string;
  fbc?: string;
}

type FacebookConfig = {
  pixelId?: string;
  accessToken?: string;
  serverEnabled?: boolean;
};

export async function enqueueMarketingEvent(
  ctx: MutationCtx,
  args: EnqueueMarketingEventArgs,
) {
  const facebookSettings = await ctx.db
    .query("marketingSettings")
    .withIndex("by_type", (q) => q.eq("type", "facebook"))
    .unique();
  const config = facebookSettings?.config as FacebookConfig | undefined;

  if (!config?.serverEnabled || !config.pixelId || !config.accessToken) {
    return null;
  }

  const existing = await ctx.db
    .query("marketingEventOutbox")
    .withIndex("by_eventId", (q) => q.eq("eventId", args.eventId))
    .unique();
  if (existing) return existing._id;

  const now = Date.now();
  const outboxId = await ctx.db.insert("marketingEventOutbox", {
    ...args,
    eventId: args.eventId.slice(0, 200),
    sourceUrl: args.sourceUrl?.slice(0, 1000),
    contentIds: args.contentIds?.slice(0, 100),
    contents: args.contents?.slice(0, 100),
    fbp: args.fbp?.slice(0, 255),
    fbc: args.fbc?.slice(0, 255),
    status: "pending",
    attempts: 0,
    nextAttemptAt: now,
  });

  await ctx.scheduler.runAfter(
    0,
    internal.marketingActions.deliverFacebookEvent,
    { outboxId },
  );
  return outboxId;
}
