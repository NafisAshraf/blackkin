"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft,
  Star,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

const CUSTOMER_ORDER_STATUS_LABELS: Record<string, string> = {
  new: "Order Placed",
  confirmed: "Confirmed",
  ready_for_delivery: "Ready for Delivery",
  in_courier: "In Transit",
  paid: "Paid",
  completed: "Completed",
  cancelled: "Cancelled",
  hold: "Processing",
  ship_later: "Processing",
  deleted: "Cancelled",
};

function getStatusVariant(
  status: string
): "outline" | "secondary" | "default" | "destructive" {
  switch (status) {
    case "new":
      return "outline";
    case "confirmed":
    case "ready_for_delivery":
      return "secondary";
    case "in_courier":
    case "paid":
    case "completed":
      return "default";
    case "cancelled":
    case "deleted":
      return "destructive";
    default:
      return "outline";
  }
}

// ─── Payment status banner ────────────────────────────────────────────────────
function PaymentBanner({ outcome }: { outcome: string | null }) {
  if (!outcome) return null;
  if (outcome === "success") {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 dark:bg-green-950/30 dark:border-green-800 px-4 py-3 text-sm text-green-700 dark:text-green-400">
        <CheckCircle2 className="h-4 w-4 shrink-0" />
        <span>Payment successful! Your order is confirmed.</span>
      </div>
    );
  }
  if (outcome === "failed") {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400">
        <XCircle className="h-4 w-4 shrink-0" />
        <span>Payment was declined. You can retry below.</span>
      </div>
    );
  }
  if (outcome === "cancelled") {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-yellow-200 bg-yellow-50 dark:bg-yellow-950/30 dark:border-yellow-800 px-4 py-3 text-sm text-yellow-700 dark:text-yellow-400">
        <AlertCircle className="h-4 w-4 shrink-0" />
        <span>Payment was cancelled. You can retry below.</span>
      </div>
    );
  }
  return null;
}

// ─── Retry payment button ─────────────────────────────────────────────────────
function RetryPaymentButton({ orderId }: { orderId: Id<"orders"> }) {
  const [retrying, setRetrying] = useState(false);
  const retryPayment = useAction(api.paymentActions.retryPayment);

  const handleRetry = async () => {
    setRetrying(true);
    try {
      toast.loading("Connecting to payment gateway…", { id: "ssl-retry" });
      const result = await retryPayment({ orderId });
      toast.dismiss("ssl-retry");
      window.location.href = result.GatewayPageURL;
    } catch (err: unknown) {
      toast.dismiss("ssl-retry");
      toast.error(err instanceof Error ? err.message : "Failed to initiate payment");
      setRetrying(false);
    }
  };

  return (
    <Button onClick={handleRetry} disabled={retrying} className="gap-2">
      {retrying ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <RefreshCw className="h-4 w-4" />
      )}
      {retrying ? "Connecting…" : "Retry Payment"}
    </Button>
  );
}

// ─── Star rating input ────────────────────────────────────────────────────────
function StarRatingInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          onMouseEnter={() => setHovered(star)}
          onMouseLeave={() => setHovered(0)}
          className="focus:outline-none"
        >
          <Star
            className={`h-5 w-5 ${
              star <= (hovered || value)
                ? "fill-yellow-400 text-yellow-400"
                : "text-muted-foreground"
            }`}
          />
        </button>
      ))}
    </div>
  );
}

// ─── Review form ──────────────────────────────────────────────────────────────
function ReviewForm({
  productId,
  orderId,
}: {
  productId: Id<"products">;
  orderId: Id<"orders">;
}) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const createReview = useMutation(api.reviews.create);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) { toast.error("Please select a rating"); return; }
    setSubmitting(true);
    try {
      await createReview({ productId, orderId, rating, ...(comment ? { comment } : {}) });
      toast.success("Review submitted!");
      setSubmitted(true);
      setOpen(false);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to submit review");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return <p className="text-sm text-muted-foreground">Review submitted. Thank you!</p>;
  }

  return (
    <div className="mt-2">
      {!open ? (
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          Leave a Review
        </Button>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3 mt-2 p-3 border rounded-md bg-muted/30">
          <div className="space-y-1">
            <p className="text-xs font-medium">Your Rating</p>
            <StarRatingInput value={rating} onChange={setRating} />
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium">Comment (optional)</p>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Share your thoughts..."
              rows={3}
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit Review"}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function OrderDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const paymentOutcome = searchParams.get("payment"); // "success" | "failed" | "cancelled"
  const orderId = params.orderId as Id<"orders">;
  const data = useQuery(api.orders.getMyOrder, { orderId });
  const payments = useQuery(api.payments.getMyPaymentsForOrder, { orderId });

  // Show toast once on mount based on payment outcome
  useEffect(() => {
    if (!paymentOutcome) return;
    if (paymentOutcome === "success") toast.success("Payment successful!");
    else if (paymentOutcome === "failed") toast.error("Payment failed. Please retry.");
    else if (paymentOutcome === "cancelled") toast.info("Payment cancelled.");
    // Remove the query param from URL without reload
    const url = new URL(window.location.href);
    url.searchParams.delete("payment");
    window.history.replaceState({}, "", url.toString());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (data === undefined) {
    return (
      <>
        <Navbar />
        <div className="flex justify-center items-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </>
    );
  }

  if (data === null) {
    return (
      <>
        <Navbar />
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <p className="text-muted-foreground">Order not found</p>
          <Link href="/account/orders">
            <Button variant="outline">Back to Orders</Button>
          </Link>
        </div>
      </>
    );
  }

  const { order, items } = data;

  // Show retry if the order is unpaid and was an online payment attempt (has payment records)
  const canRetryPayment =
    order.paymentStatus === "unpaid" &&
    order.paymentMethod === "sslcommerz" &&
    !!payments &&
    payments.length > 0 &&
    payments[0].status !== "valid";

  return (
    <>
      <Navbar />
      <main className="max-w-3xl mx-auto px-6 py-10 space-y-8">
        {/* Back */}
        <Link
          href="/account/orders"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Orders
        </Link>

        {/* Payment outcome banner */}
        <PaymentBanner outcome={paymentOutcome} />

        {/* Order Header */}
        <div className="space-y-2">
          <h1 className="text-xl font-semibold">Order Detail</h1>
          <p className="font-mono text-sm text-muted-foreground">#{order.orderNumber}</p>
          <div className="flex gap-2 flex-wrap">
            <Badge variant={getStatusVariant(order.status)}>
              {CUSTOMER_ORDER_STATUS_LABELS[order.status] ?? order.status}
            </Badge>
            <Badge variant={order.paymentStatus === "paid" ? "default" : "outline"}>
              {order.paymentStatus}
            </Badge>
            {order.paymentMethod && (
              <Badge variant="secondary">{order.paymentMethod}</Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            Placed on {new Date(order._creationTime).toLocaleDateString()}
          </p>
        </div>

        {/* Retry payment */}
        {canRetryPayment && (
          <div className="rounded-lg border border-dashed p-4 space-y-2">
            <p className="text-sm font-medium">Complete your payment</p>
            <p className="text-xs text-muted-foreground">
              This order is waiting for payment. Click below to try again.
            </p>
            <RetryPaymentButton orderId={orderId} />
          </div>
        )}

        <Separator />

        {/* Items */}
        <div className="space-y-4">
          <h2 className="font-medium">Items</h2>
          {items.map((item, idx) => (
            <div key={idx} className="space-y-1">
              <div className="flex justify-between items-start gap-4">
                <div className="flex-1">
                  <p className="text-sm font-medium">{item.productName}</p>
                  <p className="text-xs text-muted-foreground">
                    Size: {item.size}
                    {item.color ? ` · ${item.color}` : ""}
                    {" · "}Qty: {item.quantity}
                    {" · "}Unit: ৳{item.unitPrice.toLocaleString()}
                  </p>
                </div>
                <p className="text-sm font-medium whitespace-nowrap">
                  ৳{item.totalPrice.toLocaleString()}
                </p>
              </div>
              {order.status === "completed" && (
                <ReviewForm
                  productId={item.productId as Id<"products">}
                  orderId={order._id}
                />
              )}
            </div>
          ))}
        </div>

        <Separator />

        {/* Price Summary */}
        <div className="space-y-2 text-sm">
          <h2 className="font-medium">Price Summary</h2>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span>৳{order.subtotal.toLocaleString()}</span>
          </div>
          {order.discountAmount > 0 && (
            <div className="flex justify-between text-green-600">
              <span>Discount</span>
              <span>-৳{order.discountAmount.toLocaleString()}</span>
            </div>
          )}
          <Separator />
          <div className="flex justify-between font-semibold text-base">
            <span>Total</span>
            <span>৳{order.total.toLocaleString()}</span>
          </div>
        </div>

        <Separator />

        {/* Shipping Address */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Shipping Address</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1 text-muted-foreground">
            <p className="font-medium text-foreground">{order.shippingAddress.name}</p>
            <p>{order.shippingAddress.phone}</p>
            <p>{order.shippingAddress.address}</p>
          </CardContent>
        </Card>
      </main>
    </>
  );
}
