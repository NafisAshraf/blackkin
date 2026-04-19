import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

const STORE_ID = process.env.STORE_ID!;
const STORE_PASS = process.env.STORE_PASS!;
const IS_LIVE = process.env.SSLCOMMERZ_IS_LIVE === "true";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

/** Parse application/x-www-form-urlencoded POST body */
async function parseForm(req: Request): Promise<Record<string, string>> {
  const text = await req.text();
  const params = new URLSearchParams(text);
  const out: Record<string, string> = {};
  params.forEach((val, key) => {
    out[key] = val;
  });
  return out;
}

/** Validate with SSLCommerz Order Validation API */
async function validateWithSSL(
  val_id: string,
  expectedAmount: number,
): Promise<{ ok: boolean; data: Record<string, string> }> {
  try {
    const baseUrl = IS_LIVE
      ? "https://securepay.sslcommerz.com"
      : "https://sandbox.sslcommerz.com";

    const url = new URL(`${baseUrl}/validator/api/validationserverAPI.php`);
    url.searchParams.append("val_id", val_id);
    url.searchParams.append("store_id", STORE_ID);
    url.searchParams.append("store_passwd", STORE_PASS);
    url.searchParams.append("v", "1");
    url.searchParams.append("format", "json");

    const res = await fetch(url.toString());
    const data = (await res.json()) as Record<string, string>;

    // Valid statuses are VALID or VALIDATED
    const validStatuses = ["VALID", "VALIDATED"];
    const amountOk = parseFloat(data.amount ?? "0") >= expectedAmount - 1; // 1 BDT tolerance
    return { ok: validStatuses.includes(data.status) && amountOk, data };
  } catch (err) {
    console.error("[SSL validate] error:", err);
    return { ok: false, data: {} };
  }
}

// ─── POST /payment/success ────────────────────────────────────────────────────
export const handleSuccess = httpAction(async (ctx, req) => {
  try {
    const body = await parseForm(req);
    const { tran_id, val_id, status } = body;

    if (!tran_id) {
      return Response.redirect(
        `${SITE_URL}/account/orders?payment=failed`,
        303,
      );
    }

    const payment = await ctx.runQuery(internal.payments.getByTranId, {
      tranId: tran_id,
    });
    if (!payment) {
      return Response.redirect(
        `${SITE_URL}/account/orders?payment=failed`,
        303,
      );
    }

    const orderId = payment.orderId;

    if (status === "VALID" && val_id) {
      const { ok, data } = await validateWithSSL(val_id, payment.amount);
      if (ok) {
        await ctx.runMutation(internal.payments.updateStatus, {
          tranId: tran_id,
          status: "valid",
          valId: data.val_id,
          bankTranId: data.bank_tran_id,
          cardType: data.card_type,
          cardNo: data.card_no,
          cardBrand: data.card_brand,
          storeAmount: parseFloat(data.store_amount ?? "0"),
          riskLevel: data.risk_level,
          riskTitle: data.risk_title,
        });
        await ctx.runMutation(internal.orders.updatePaymentStatusInternal, {
          orderId,
          paymentStatus: "paid",
          paymentMethod: "sslcommerz",
        });
        // Confirm voucher usage (pending → confirmed)
        await ctx.runMutation(internal.vouchers.confirmVoucherUsage, {
          orderId,
        });
        return Response.redirect(
          `${SITE_URL}/account/orders/${orderId}?payment=success`,
          303,
        );
      }
    }

    // Validation failed or status not VALID
    await ctx.runMutation(internal.payments.updateStatus, {
      tranId: tran_id,
      status: "failed",
    });
    return Response.redirect(
      `${SITE_URL}/account/orders/${orderId}?payment=failed`,
      303,
    );
  } catch (err) {
    console.error("[/payment/success] error:", err);
    return Response.redirect(`${SITE_URL}/account/orders?payment=failed`, 303);
  }
});

// ─── POST /payment/fail ───────────────────────────────────────────────────────
export const handleFail = httpAction(async (ctx, req) => {
  try {
    const body = await parseForm(req);
    const { tran_id } = body;
    if (tran_id) {
      const payment = await ctx.runQuery(internal.payments.getByTranId, {
        tranId: tran_id,
      });
      if (payment) {
        await ctx.runMutation(internal.payments.updateStatus, {
          tranId: tran_id,
          status: "failed",
        });
        return Response.redirect(
          `${SITE_URL}/account/orders/${payment.orderId}?payment=failed`,
          303,
        );
      }
    }
    return Response.redirect(`${SITE_URL}/account/orders?payment=failed`, 303);
  } catch (err) {
    console.error("[/payment/fail] error:", err);
    return Response.redirect(`${SITE_URL}/account/orders?payment=failed`, 303);
  }
});

// ─── POST /payment/cancel ─────────────────────────────────────────────────────
export const handleCancel = httpAction(async (ctx, req) => {
  try {
    const body = await parseForm(req);
    const { tran_id } = body;
    if (tran_id) {
      const payment = await ctx.runQuery(internal.payments.getByTranId, {
        tranId: tran_id,
      });
      if (payment) {
        await ctx.runMutation(internal.payments.updateStatus, {
          tranId: tran_id,
          status: "cancelled",
        });
        return Response.redirect(
          `${SITE_URL}/account/orders/${payment.orderId}?payment=cancelled`,
          303,
        );
      }
    }
    return Response.redirect(
      `${SITE_URL}/account/orders?payment=cancelled`,
      303,
    );
  } catch (err) {
    console.error("[/payment/cancel] error:", err);
    return Response.redirect(
      `${SITE_URL}/account/orders?payment=cancelled`,
      303,
    );
  }
});

// ─── POST /payment/ipn ────────────────────────────────────────────────────────
// Server-to-server from SSLCommerz — authoritative source, always returns 200
export const handleIpn = httpAction(async (ctx, req) => {
  try {
    const body = await parseForm(req);
    const { tran_id, val_id, status } = body;

    console.log("[IPN]", { tran_id, status });

    if (!tran_id) return new Response("OK", { status: 200 });

    const payment = await ctx.runQuery(internal.payments.getByTranId, {
      tranId: tran_id,
    });
    if (!payment) {
      console.warn("[IPN] payment not found for tran_id:", tran_id);
      return new Response("OK", { status: 200 });
    }

    // Idempotent: already confirmed
    if (payment.status === "valid") return new Response("OK", { status: 200 });

    const orderId = payment.orderId;

    if (status === "VALID" && val_id) {
      const { ok, data } = await validateWithSSL(val_id, payment.amount);
      if (ok) {
        await ctx.runMutation(internal.payments.updateStatus, {
          tranId: tran_id,
          status: "valid",
          valId: data.val_id,
          bankTranId: data.bank_tran_id,
          cardType: data.card_type,
          cardNo: data.card_no,
          cardBrand: data.card_brand,
          storeAmount: parseFloat(data.store_amount ?? "0"),
          riskLevel: data.risk_level,
          riskTitle: data.risk_title,
        });
        await ctx.runMutation(internal.orders.updatePaymentStatusInternal, {
          orderId,
          paymentStatus: "paid",
          paymentMethod: "sslcommerz",
        });
        // Confirm voucher usage (pending → confirmed)
        await ctx.runMutation(internal.vouchers.confirmVoucherUsage, {
          orderId,
        });
      }
    } else if (status === "FAILED") {
      await ctx.runMutation(internal.payments.updateStatus, {
        tranId: tran_id,
        status: "failed",
      });
    } else if (status === "CANCELLED") {
      await ctx.runMutation(internal.payments.updateStatus, {
        tranId: tran_id,
        status: "cancelled",
      });
    } else if (status === "UNATTEMPTED" || status === "EXPIRED") {
      await ctx.runMutation(internal.payments.updateStatus, {
        tranId: tran_id,
        status: "expired",
      });
    }
  } catch (err) {
    console.error("[IPN] error:", err);
  }
  // Always return 200 to SSLCommerz
  return new Response("OK", { status: 200 });
});
