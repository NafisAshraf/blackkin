"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/convex/_generated/api";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Loader2, Home, Briefcase, MapPin, CreditCard, Banknote } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type AddressMode = "home" | "work" | "custom";
type SaveAs = "home" | "work" | "none";

type PaymentMethod = "cod" | "sslcommerz";

export default function CheckoutPage() {
  const router = useRouter();
  const cart = useQuery(api.cart.getCartWithPricing, {});
  const savedAddresses = useQuery(api.addresses.getSavedAddresses, {});
  const cartSizes = cart ? Array.from(new Set(cart.items.map((i) => i.size))) : [];
  const recommendations = useQuery(
    api.recommendations.getAlsoBought,
    cart !== undefined ? { sizes: cartSizes } : "skip"
  );
  const createOrder = useMutation(api.orders.create);
  const saveAddressMutation = useMutation(api.addresses.saveAddress);
  const initiatePayment = useAction(api.paymentActions.initiate);

  // Address mode: which pill is selected
  const [addressMode, setAddressMode] = useState<AddressMode>("custom");
  // Whether we've auto-initialised the mode from saved addresses
  const modeInitialised = useRef(false);

  // Shipping form fields
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [city, setCity] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [notes, setNotes] = useState("");

  // For the "save custom address" flow
  const [saveAs, setSaveAs] = useState<SaveAs>("none");

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cod");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const homeAddress = savedAddresses?.find((a) => a.type === "home");
  const workAddress = savedAddresses?.find((a) => a.type === "work");
  const hasSavedAddresses = savedAddresses !== undefined && savedAddresses.length > 0;

  // Auto-initialise mode to the first available saved address
  useEffect(() => {
    if (savedAddresses === undefined) return;
    if (modeInitialised.current) return;
    modeInitialised.current = true;

    if (homeAddress) {
      setAddressMode("home");
    } else if (workAddress) {
      setAddressMode("work");
    }
    // else stays "custom"
  }, [savedAddresses, homeAddress, workAddress]);

  // Fill form fields whenever the mode changes
  useEffect(() => {
    if (addressMode === "home" && homeAddress) {
      setName(homeAddress.name);
      setPhone(homeAddress.phone);
      setAddressLine1(homeAddress.addressLine1);
      setAddressLine2(homeAddress.addressLine2 ?? "");
      setCity(homeAddress.city);
      setPostalCode(homeAddress.postalCode ?? "");
    } else if (addressMode === "work" && workAddress) {
      setName(workAddress.name);
      setPhone(workAddress.phone);
      setAddressLine1(workAddress.addressLine1);
      setAddressLine2(workAddress.addressLine2 ?? "");
      setCity(workAddress.city);
      setPostalCode(workAddress.postalCode ?? "");
    } else if (addressMode === "custom") {
      setName("");
      setPhone("");
      setAddressLine1("");
      setAddressLine2("");
      setCity("");
      setPostalCode("");
      setSaveAs("none");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addressMode]);

  // If selected saved address gets deleted externally, fall back gracefully
  useEffect(() => {
    if (savedAddresses === undefined) return;
    if (addressMode === "home" && !homeAddress) {
      setAddressMode(workAddress ? "work" : "custom");
    } else if (addressMode === "work" && !workAddress) {
      setAddressMode(homeAddress ? "home" : "custom");
    }
  }, [savedAddresses, addressMode, homeAddress, workAddress]);

  // Slots available for "save as" (only slots not already occupied)
  const availableSaveSlots: SaveAs[] = [];
  if (!homeAddress) availableSaveSlots.push("home");
  if (!workAddress) availableSaveSlots.push("work");
  const canSaveAddress = addressMode === "custom" && availableSaveSlots.length > 0;

  const shippingAddress = {
    name,
    phone,
    addressLine1,
    ...(addressLine2.trim() ? { addressLine2: addressLine2.trim() } : {}),
    city,
    ...(postalCode.trim() ? { postalCode: postalCode.trim() } : {}),
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (paymentMethod === "cod") {
        // ── Cash on Delivery ──
        await createOrder({
          shippingAddress,
          ...(notes.trim() ? { notes: notes.trim() } : {}),
        });

        // Fire-and-forget address save if user opted in
        if (addressMode === "custom" && saveAs !== "none") {
          saveAddressMutation({
            type: saveAs,
            ...shippingAddress,
          }).catch(console.error);
        }

        toast.success("Order placed!");
        router.push("/account/orders");
      } else {
        // ── SSLCommerz Online Payment ──
        toast.loading("Connecting to payment gateway…", { id: "ssl-init" });
        const result = await initiatePayment({
          shippingAddress,
          ...(notes.trim() ? { notes: notes.trim() } : {}),
        });
        toast.dismiss("ssl-init");
        // Full-page redirect to SSLCommerz hosted payment page
        window.location.href = result.GatewayPageURL;
      }
    } catch (e: unknown) {
      toast.dismiss("ssl-init");
      toast.error(e instanceof Error ? e.message : "Failed to place order");
      setIsSubmitting(false);
    }
    // Note: for sslcommerz we don't setIsSubmitting(false) — page navigates away
  };

  if (cart === undefined || savedAddresses === undefined) {
    return (
      <>
        <Navbar />
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </>
    );
  }

  if (!cart || cart.items.length === 0) {
    return (
      <>
        <Navbar />
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <p className="text-muted-foreground text-lg">Your cart is empty</p>
          <Link href="/products">
            <Button variant="outline">Browse Products</Button>
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <main className="max-w-6xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-semibold mb-8">Checkout</h1>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          {/* Left: Shipping Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <h2 className="text-lg font-medium">Shipping Information</h2>

            {/* Address pill toggle — only shown when user has saved addresses */}
            {hasSavedAddresses && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                  Deliver to
                </Label>
                <div className="flex gap-1.5 flex-wrap">
                  {homeAddress && (
                    <button
                      type="button"
                      onClick={() => setAddressMode("home")}
                      className={cn(
                        "flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium border transition-all",
                        addressMode === "home"
                          ? "bg-foreground text-background border-foreground"
                          : "border-border text-muted-foreground hover:border-foreground hover:text-foreground bg-background"
                      )}
                    >
                      <Home className="h-3.5 w-3.5" />
                      Home
                    </button>
                  )}
                  {workAddress && (
                    <button
                      type="button"
                      onClick={() => setAddressMode("work")}
                      className={cn(
                        "flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium border transition-all",
                        addressMode === "work"
                          ? "bg-foreground text-background border-foreground"
                          : "border-border text-muted-foreground hover:border-foreground hover:text-foreground bg-background"
                      )}
                    >
                      <Briefcase className="h-3.5 w-3.5" />
                      Work
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setAddressMode("custom")}
                    className={cn(
                      "flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium border transition-all",
                      addressMode === "custom"
                        ? "bg-foreground text-background border-foreground"
                        : "border-border text-muted-foreground hover:border-foreground hover:text-foreground bg-background"
                    )}
                  >
                    <MapPin className="h-3.5 w-3.5" />
                    Custom
                  </button>
                </div>
                {addressMode !== "custom" && (
                  <p className="text-xs text-muted-foreground">
                    Fields are pre-filled from your saved address. You can edit them for this order.
                  </p>
                )}
              </div>
            )}

            <div className="space-y-1">
              <Label htmlFor="name">Full Name *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="John Doe"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="phone">Phone *</Label>
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                placeholder="+880 1XXX XXXXXX"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="addressLine1">Address Line 1 *</Label>
              <Input
                id="addressLine1"
                value={addressLine1}
                onChange={(e) => setAddressLine1(e.target.value)}
                required
                placeholder="House/Flat, Road, Area"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="addressLine2">Address Line 2</Label>
              <Input
                id="addressLine2"
                value={addressLine2}
                onChange={(e) => setAddressLine2(e.target.value)}
                placeholder="Optional"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="city">City *</Label>
                <Input
                  id="city"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  required
                  placeholder="Dhaka"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="postalCode">Postal Code</Label>
                <Input
                  id="postalCode"
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                  placeholder="1207"
                />
              </div>
            </div>

            {/* Save address option — only shown for custom addresses when a slot is available */}
            {canSaveAddress && (
              <div className="space-y-1.5 p-3 bg-muted/50 rounded-md border border-border">
                <Label htmlFor="saveAs" className="text-sm">
                  Save this address?
                </Label>
                <select
                  id="saveAs"
                  value={saveAs}
                  onChange={(e) => setSaveAs(e.target.value as SaveAs)}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="none">Do not save</option>
                  {availableSaveSlots.includes("home") && (
                    <option value="home">Save as Home address</option>
                  )}
                  {availableSaveSlots.includes("work") && (
                    <option value="work">Save as Work address</option>
                  )}
                </select>
              </div>
            )}

            <Separator />

            {/* Payment Method */}
            <div className="space-y-3">
              <Label>Payment Method</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Cash on Delivery */}
                <label
                  className={`flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                    paymentMethod === "cod"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="cod"
                    checked={paymentMethod === "cod"}
                    onChange={() => setPaymentMethod("cod")}
                    className="accent-primary"
                    id="pm-cod"
                  />
                  <Banknote className="h-5 w-5 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-sm font-medium">Cash on Delivery</p>
                    <p className="text-xs text-muted-foreground">Pay when you receive</p>
                  </div>
                </label>

                {/* Online Payment */}
                <label
                  className={`flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                    paymentMethod === "sslcommerz"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="sslcommerz"
                    checked={paymentMethod === "sslcommerz"}
                    onChange={() => setPaymentMethod("sslcommerz")}
                    className="accent-primary"
                    id="pm-online"
                  />
                  <CreditCard className="h-5 w-5 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-sm font-medium">Online Payment</p>
                    <p className="text-xs text-muted-foreground">Card, Mobile Banking &amp; More</p>
                  </div>
                </label>
              </div>

              {paymentMethod === "sslcommerz" && (
                <p className="text-xs text-muted-foreground">
                  You&apos;ll be redirected to SSLCommerz secure payment page. Supports VISA,
                  Mastercard, bKash, Nagad and more.
                </p>
              )}
            </div>

            <Separator />

            <div className="space-y-1">
              <Label htmlFor="notes">Order Notes (optional)</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any special instructions..."
                rows={3}
              />
            </div>

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {paymentMethod === "sslcommerz" ? "Connecting…" : "Placing Order…"}
                </>
              ) : paymentMethod === "sslcommerz" ? (
                "Pay Online"
              ) : (
                "Place Order"
              )}
            </Button>
          </form>

          {/* Right: Order Summary */}
          <div className="space-y-6">
            <h2 className="text-lg font-medium">Order Summary</h2>

            <div className="space-y-4">
              {cart.items.map((item) => (
                <div key={item._id} className="flex gap-4 items-start">
                  {item.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.imageUrl}
                      alt={item.productName}
                      className="w-16 h-16 object-cover rounded-md bg-muted flex-shrink-0"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium line-clamp-2">{item.productName}</p>
                    <p className="text-xs text-muted-foreground">
                      Size: {item.size}
                      {item.color ? ` · ${item.color}` : ""}
                      {" · "}Qty: {item.quantity}
                    </p>
                  </div>
                  <p className="text-sm font-medium whitespace-nowrap">
                    ৳{(item.discountedPrice * item.quantity).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>

            <Separator />

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>৳{cart.subtotal.toLocaleString()}</span>
              </div>
              {cart.discountAmount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Discount</span>
                  <span>-৳{cart.discountAmount.toLocaleString()}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between font-semibold text-base">
                <span>Total</span>
                <span>৳{cart.total.toLocaleString()}</span>
              </div>
            </div>

            {/* People Also Bought */}
            {recommendations && recommendations.length > 0 && (
              <div className="space-y-3 pt-4">
                <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                  People Also Bought
                </h3>
                <div className="flex gap-3 overflow-x-auto pb-2">
                  {recommendations.map((product) => (
                    <Link
                      key={product._id}
                      href={`/products/${product.slug}`}
                      className="w-36 flex-shrink-0 block border rounded-md overflow-hidden hover:shadow-sm transition-shadow"
                    >
                      <div className="aspect-square relative bg-muted">
                        {product.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={product.imageUrl}
                            alt={product.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
                            No image
                          </div>
                        )}
                      </div>
                      <div className="p-2 space-y-0.5">
                        <p className="text-xs font-medium line-clamp-2">{product.name}</p>
                        <p className="text-xs text-muted-foreground">
                          ৳{product.discountedPrice.toLocaleString()}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
