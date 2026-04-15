
"use node";

import { action } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import SSLCommerzPayment from "sslcommerz-lts";

const STORE_ID = process.env.STORE_ID!.trim();
const STORE_PASS = process.env.STORE_PASS!.trim();
const IS_LIVE = process.env.SSLCOMMERZ_IS_LIVE === "true";
const CONVEX_SITE_URL = process.env.NEXT_PUBLIC_CONVEX_SITE_URL!.trim();

function genTranId(): string {
  return `BLK-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

const shippingAddressValidator = v.object({
  name: v.string(),
  phone: v.string(),
  address: v.string(),
});

/** Build the SSLCommerz payload */
function buildSslData(params: {
  tranId: string;
  total: number;
  items: Array<{ productName: string; quantity: number; unitPrice: number; variantId: string }>;
  shippingAddress: { name: string; phone: string; address: string };
  cusEmail: string;
  cusName: string;
  orderId: string;
}) {
  const { tranId, total, items, shippingAddress, cusEmail, cusName, orderId } = params;
  return {
    total_amount: total,
    currency: "BDT",
    tran_id: tranId,
    success_url: `${CONVEX_SITE_URL}/payment/success`,
    fail_url:    `${CONVEX_SITE_URL}/payment/fail`,
    cancel_url:  `${CONVEX_SITE_URL}/payment/cancel`,
    ipn_url:     `${CONVEX_SITE_URL}/payment/ipn`,
    shipping_method: "Courier",
    product_name: items.map((i) => i.productName).join(", ").slice(0, 255),
    product_category: "Clothing",
    product_profile: "physical-goods",
    cus_name: cusName || "Customer",
    cus_email: cusEmail,
    cus_add1: shippingAddress.address,
    cus_add2: "",
    cus_city: "Dhaka",
    cus_state: "Dhaka",
    cus_postcode: "1000",
    cus_country: "Bangladesh",
    cus_phone: shippingAddress.phone,
    ship_name: shippingAddress.name,
    ship_add1: shippingAddress.address,
    ship_add2: "",
    ship_city: "Dhaka",
    ship_state: "Dhaka",
    ship_postcode: "1000",
    ship_country: "Bangladesh",
    num_of_item: items.reduce((s, i) => s + i.quantity, 0),
    // The SSLCommerz sandbox throws a 500 error if the cart JSON is populated.
    // Sending an empty array circumvents the issue without affecting the total payment.
    cart: JSON.stringify([]),
    product_amount: total,
    vat: 0,
    discount_amount: 0,
    convenience_fee: 0,
    value_a: orderId, // store orderId so IPN can cross-reference
  };
}

// ─── Public action: initiate a new SSLCommerz payment for a new cart ─────────

export const initiate = action({
  args: {
    shippingAddress: shippingAddressValidator,
    notes: v.optional(v.string()),
  },
  returns: v.object({
    GatewayPageURL: v.string(),
    orderId: v.string(),
  }),
  handler: async (ctx, args) => {
    // 1. Resolve user from Convex JWT
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Unauthenticated");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const user: any = await ctx.runQuery(internal.users.getByAuthUserIdInternal, {
      authUserId: identity.subject,
    });
    if (!user) throw new ConvexError("User not found");

    // 2. Create order (validates cart server-side, decrements stock, clears cart)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const created: any = await ctx.runMutation(internal.orders.createInternal, {
      userId: user._id,
      shippingAddress: args.shippingAddress,
      notes: args.notes,
    });

    // 3. Call SSLCommerz
    const tranId = genTranId();
    const sslData = buildSslData({
      tranId,
      total: created.total,
      items: created.items,
      shippingAddress: args.shippingAddress,
      cusEmail: user.email ?? user.phone ?? "customer@blackkin.local",
      cusName: user.name ?? args.shippingAddress.name,
      orderId: created.orderId,
    });

    const sslcz = new SSLCommerzPayment(STORE_ID, STORE_PASS, IS_LIVE);
    const apiResponse: any = await sslcz.init(sslData).catch((e: Error) => {
      return { status: "FAILED", failedreason: e.message };
    });
    console.log("SSL API RESPONSE:", apiResponse, sslData);

    if (apiResponse?.status !== "SUCCESS" || !apiResponse?.GatewayPageURL) {
      await ctx.runMutation(internal.orders.cancelAndRestockInternal, {
        orderId: created.orderId,
      });
      throw new ConvexError(
        apiResponse?.failedreason ?? "Payment gateway unavailable. Please try again."
      );
    }

    // 4. Persist payment record
    await ctx.runMutation(internal.payments.create, {
      orderId: created.orderId,
      tranId,
      sessionKey: apiResponse.sessionkey,
      gatewayPageUrl: apiResponse.GatewayPageURL,
      amount: created.total,
      currency: "BDT",
    });

    return { GatewayPageURL: apiResponse.GatewayPageURL, orderId: created.orderId };
  },
});

// ─── Public action: retry payment for an existing unpaid order ───────────────

export const retryPayment = action({
  args: { orderId: v.id("orders") },
  returns: v.object({
    GatewayPageURL: v.string(),
    orderId: v.string(),
  }),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Unauthenticated");

    const user = await ctx.runQuery(internal.users.getByAuthUserIdInternal, {
      authUserId: identity.subject,
    });
    if (!user) throw new ConvexError("User not found");

    // Fetch order + items
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await ctx.runQuery(internal.orders.getOrderWithItemsInternal, {
      orderId: args.orderId,
    });
    if (!data) throw new ConvexError("Order not found");
    if (data.order.userId !== user._id) throw new ConvexError("Unauthorized");
    if (data.order.paymentStatus === "paid") throw new ConvexError("Order is already paid");

    const { order, items } = data;
    const shippingAddress = order.shippingAddress;

    const tranId = genTranId();
    const sslData = buildSslData({
      tranId,
      total: order.total,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      items: items.map((i: any) => ({
        productName: i.productName,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        variantId: i.variantId as unknown as string,
      })),
      shippingAddress: {
        name: shippingAddress.name,
        phone: shippingAddress.phone,
        address: shippingAddress.address,
      },
      cusEmail: user.email ?? user.phone ?? "customer@blackkin.local",
      cusName: user.name ?? shippingAddress.name,
      orderId: args.orderId as unknown as string,
    });

    const sslcz = new SSLCommerzPayment(STORE_ID, STORE_PASS, IS_LIVE);
    const apiResponse: any = await sslcz.init(sslData).catch((e: Error) => {
      return { status: "FAILED", failedreason: e.message };
    });

    if (apiResponse?.status !== "SUCCESS" || !apiResponse?.GatewayPageURL) {
      throw new ConvexError(
        apiResponse?.failedreason ?? "Payment gateway unavailable. Please try again."
      );
    }

    await ctx.runMutation(internal.payments.create, {
      orderId: args.orderId,
      tranId,
      sessionKey: apiResponse.sessionkey,
      gatewayPageUrl: apiResponse.GatewayPageURL,
      amount: order.total,
      currency: "BDT",
    });

    return {
      GatewayPageURL: apiResponse.GatewayPageURL,
      orderId: args.orderId as unknown as string,
    };
  },
});

// ─── Admin action: generate a payment link for a specific due amount ──────────

export const generateAdminPaymentLink = action({
  args: {
    orderId: v.id("orders"),
    dueAmount: v.number(),
  },
  returns: v.object({ GatewayPageURL: v.string() }),
  handler: async (ctx, { orderId, dueAmount }) => {
    if (dueAmount <= 0) throw new ConvexError("Due amount must be positive");

    // Auth: must be admin or superadmin
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Unauthenticated");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const callerUser: any = await ctx.runQuery(internal.users.getByAuthUserIdInternal, {
      authUserId: identity.subject,
    });
    if (!callerUser || callerUser.isActive === false) throw new ConvexError("Account deactivated");
    if (!callerUser || (callerUser.role !== "admin" && callerUser.role !== "superadmin")) {
      throw new ConvexError("Unauthorized");
    }
    if (callerUser.role === "admin") {
      const op = callerUser.permissions?.orders;
      if (!op || !op.enabled || !op.canEdit) throw new ConvexError("Unauthorized");
    }

    // Fetch order info
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await ctx.runQuery(internal.orders.getOrderWithItemsInternal, { orderId });
    if (!data) throw new ConvexError("Order not found");
    const { order, items, user } = data;

    const tranId = genTranId();
    const sslData = buildSslData({
      tranId,
      total: dueAmount,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      items: items.map((i: any) => ({
        productName: i.productName,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        variantId: i.variantId as unknown as string,
      })),
      shippingAddress: {
        name: order.shippingAddress.name,
        phone: order.shippingAddress.phone,
        address: order.shippingAddress.address,
      },
      cusEmail: order.shippingAddress.email ?? user?.email ?? "customer@blackkin.local",
      cusName: order.shippingAddress.name,
      orderId: orderId as unknown as string,
    });

    const sslcz = new SSLCommerzPayment(STORE_ID, STORE_PASS, IS_LIVE);
    const apiResponse: any = await sslcz.init(sslData).catch((e: Error) => ({
      status: "FAILED",
      failedreason: e.message,
    }));

    if (apiResponse?.status !== "SUCCESS" || !apiResponse?.GatewayPageURL) {
      throw new ConvexError(
        apiResponse?.failedreason ?? "Payment gateway unavailable. Please try again."
      );
    }

    await ctx.runMutation(internal.payments.create, {
      orderId,
      tranId,
      sessionKey: apiResponse.sessionkey,
      gatewayPageUrl: apiResponse.GatewayPageURL,
      amount: dueAmount,
      currency: "BDT",
    });

    return { GatewayPageURL: apiResponse.GatewayPageURL };
  },
});

