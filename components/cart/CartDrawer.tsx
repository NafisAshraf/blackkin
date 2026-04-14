"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { authClient } from "@/lib/auth-client";
import { useCart } from "./CartProvider";
import Link from "next/link";
import { useState } from "react";
import { Minus, Plus, Trash2, Loader2, X } from "lucide-react";
import { getGuestCart } from "@/lib/guest-cart";
import { Id } from "@/convex/_generated/dataModel";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function CartDrawer() {
  const { data: session } = authClient.useSession();
  const { isOpen, setIsOpen, guestItemCount, removeGuestItem, updateGuestQuantity } = useCart();

  const cartItems = useQuery(api.cart.get, session ? {} : "skip");
  const removeItem = useMutation(api.cart.remove);
  const updateItemQty = useMutation(api.cart.updateQuantity);

  // Guest: read localStorage and enrich via Convex
  const guestLocalItems = getGuestCart();
  const guestCartItems = useQuery(
    api.cart.getGuestCartItems,
    !session ? { items: guestLocalItems } : "skip"
  );

  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{
    id: string; // cartItemId for logged-in, variantId for guest
    name: string;
    isGuest: boolean;
  } | null>(null);

  const handleRemove = async (cartItemId: Id<"cartItems">) => {
    setLoadingId(cartItemId);
    try {
      await removeItem({ cartItemId });
    } finally {
      setLoadingId(null);
    }
  };

  const handleQtyChange = async (cartItemId: Id<"cartItems">, qty: number) => {
    if (qty < 1) return;
    setLoadingId(cartItemId + "_qty");
    try {
      await updateItemQty({ cartItemId, quantity: qty });
    } finally {
      setLoadingId(null);
    }
  };

  const handleGuestQtyChange = (variantId: string, qty: number) => {
    if (qty < 1) return;
    updateGuestQuantity(variantId, qty);
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    if (pendingDelete.isGuest) {
      removeGuestItem(pendingDelete.id);
    } else {
      await handleRemove(pendingDelete.id as Id<"cartItems">);
    }
    setPendingDelete(null);
  };

  const subtotal = session
    ? (cartItems?.reduce((sum, i) => sum + i.discountedPrice * i.quantity, 0) ?? 0)
    : (guestCartItems?.reduce((sum, i) => sum + i.discountedPrice * i.quantity, 0) ?? 0);

  const itemCount = session
    ? (cartItems?.reduce((sum, i) => sum + i.quantity, 0) ?? 0)
    : guestItemCount;

  // isEmpty: true when localStorage is empty OR query loaded and returned no valid items
  const isEmpty = session
    ? (cartItems?.length ?? 0) === 0
    : guestLocalItems.length === 0 ||
      (guestCartItems !== undefined && guestCartItems.length === 0);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-50 transition-opacity"
        onClick={() => setIsOpen(false)}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 bottom-0 w-full sm:w-[480px] bg-white z-50 flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-border">
          <h2 className="text-sm font-semibold tracking-wider uppercase">
            My Cart {itemCount > 0 ? `(${itemCount})` : ""}
          </h2>
          <button
            onClick={() => setIsOpen(false)}
            className="h-8 w-8 flex items-center justify-center hover:bg-muted transition-colors rounded"
            aria-label="Close cart"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto">
          {isEmpty ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-6">
              <p className="text-muted-foreground text-sm">Your cart is empty</p>
              <button
                onClick={() => setIsOpen(false)}
                className="border border-border px-6 py-2.5 text-xs font-semibold uppercase tracking-wider hover:bg-muted transition-colors"
              >
                <Link href="/products">Browse Products</Link>
              </button>
            </div>
          ) : session ? (
            /* ── Logged-in items ── */
            <div className="divide-y divide-border">
              {(cartItems ?? []).map((item) => {
                const isDiscounted = item.basePrice && item.discountedPrice < item.basePrice;
                const isQtyLoading = loadingId === item._id + "_qty";
                return (
                  <div key={item._id} className="flex gap-4 px-6 py-5">
                    <div className="h-20 w-20 flex-shrink-0 bg-muted overflow-hidden">
                      {item.imageUrl ? (
                        <img src={item.imageUrl} alt={item.productName} className="object-cover h-full w-full" />
                      ) : (
                        <div className="h-full w-full bg-muted" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      {isDiscounted && (
                        <p className="text-[10px] font-bold text-red-600 tracking-wider mb-0.5">
                          {Math.round(((item.basePrice - item.discountedPrice) / item.basePrice) * 100)}% OFF
                        </p>
                      )}
                      <p className="text-sm font-medium leading-tight line-clamp-2 mb-1">{item.productName}</p>
                      <p className="text-xs text-muted-foreground mb-3">
                        {item.color && <span>{item.color} </span>}
                        <span>{item.size}</span>
                      </p>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center border border-border">
                          {item.quantity === 1 ? (
                            <button
                              className="h-7 w-7 flex items-center justify-center hover:bg-muted transition-colors disabled:opacity-40"
                              disabled={isQtyLoading || loadingId === item._id}
                              onClick={() => setPendingDelete({ id: item._id, name: item.productName, isGuest: false })}
                              aria-label="Remove item"
                            >
                              <Trash2 className="h-3 w-3 text-destructive" />
                            </button>
                          ) : (
                            <button
                              className="h-7 w-7 flex items-center justify-center hover:bg-muted transition-colors disabled:opacity-40"
                              disabled={isQtyLoading}
                              onClick={() => handleQtyChange(item._id, item.quantity - 1)}
                            >
                              <Minus className="h-3 w-3" />
                            </button>
                          )}
                          <span className="h-7 w-8 flex items-center justify-center text-xs font-medium border-x border-border">
                            {isQtyLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : item.quantity}
                          </span>
                          <button
                            className="h-7 w-7 flex items-center justify-center hover:bg-muted transition-colors disabled:opacity-40"
                            disabled={item.quantity >= item.stock || isQtyLoading}
                            onClick={() => handleQtyChange(item._id, item.quantity + 1)}
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="text-sm font-semibold">
                            ৳{(item.discountedPrice * item.quantity).toLocaleString()}
                          </span>
                          <button
                            className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
                            disabled={loadingId === item._id}
                            onClick={() => handleRemove(item._id)}
                            aria-label="Remove item"
                          >
                            {loadingId === item._id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : guestCartItems === undefined ? (
            /* ── Guest loading ── */
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            /* ── Guest full items ── */
            <div className="divide-y divide-border">
              {guestCartItems.map((item) => {
                const isDiscounted = item.discountedPrice < item.basePrice;
                return (
                  <div key={item.variantId} className="flex gap-4 px-6 py-5">
                    <div className="h-20 w-20 flex-shrink-0 bg-muted overflow-hidden">
                      {item.imageUrl ? (
                        <img src={item.imageUrl} alt={item.productName} className="object-cover h-full w-full" />
                      ) : (
                        <div className="h-full w-full bg-muted" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      {isDiscounted && (
                        <p className="text-[10px] font-bold text-red-600 tracking-wider mb-0.5">
                          {Math.round(((item.basePrice - item.discountedPrice) / item.basePrice) * 100)}% OFF
                        </p>
                      )}
                      <p className="text-sm font-medium leading-tight line-clamp-2 mb-1">{item.productName}</p>
                      <p className="text-xs text-muted-foreground mb-3">
                        {item.color && <span>{item.color} </span>}
                        <span>{item.size}</span>
                      </p>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center border border-border">
                          {item.quantity === 1 ? (
                            <button
                              className="h-7 w-7 flex items-center justify-center hover:bg-muted transition-colors"
                              onClick={() => setPendingDelete({ id: item.variantId, name: item.productName, isGuest: true })}
                              aria-label="Remove item"
                            >
                              <Trash2 className="h-3 w-3 text-destructive" />
                            </button>
                          ) : (
                            <button
                              className="h-7 w-7 flex items-center justify-center hover:bg-muted transition-colors"
                              onClick={() => handleGuestQtyChange(item.variantId, item.quantity - 1)}
                            >
                              <Minus className="h-3 w-3" />
                            </button>
                          )}
                          <span className="h-7 w-8 flex items-center justify-center text-xs font-medium border-x border-border">
                            {item.quantity}
                          </span>
                          <button
                            className="h-7 w-7 flex items-center justify-center hover:bg-muted transition-colors disabled:opacity-40"
                            disabled={item.quantity >= item.stock}
                            onClick={() => handleGuestQtyChange(item.variantId, item.quantity + 1)}
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>

                        <span className="text-sm font-semibold">
                          ৳{(item.discountedPrice * item.quantity).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer — show only when items are loaded and present */}
        {!isEmpty && (!!session || guestCartItems !== undefined) && (
          <div className="border-t border-border px-6 py-5 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold tracking-wider uppercase">Subtotal</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Shipping calculated at checkout
                </p>
              </div>
              <span className="text-lg font-bold">৳{subtotal.toLocaleString()}</span>
            </div>
            <Link
              href={session ? "/checkout" : "/login?next=/checkout"}
              onClick={() => setIsOpen(false)}
              className="block w-full bg-foreground text-background text-xs font-semibold tracking-[0.2em] uppercase text-center py-4 hover:opacity-90 transition-opacity"
            >
              Checkout
            </Link>
            <button
              onClick={() => setIsOpen(false)}
              className="block w-full border border-border text-xs font-semibold tracking-wider uppercase text-center py-3 hover:bg-muted transition-colors"
            >
              <Link href="/products">Continue Shopping</Link>
            </button>
          </div>
        )}
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove from cart?</AlertDialogTitle>
            <AlertDialogDescription>
              Remove &ldquo;{pendingDelete?.name}&rdquo; from your cart?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
