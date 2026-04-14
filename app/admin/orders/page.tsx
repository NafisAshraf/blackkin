"use client";

import { useState, useEffect } from "react";
import { useQuery, usePaginatedQuery, useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { toast } from "sonner";
import {
  Loader2,
  CheckCircle,
  Trash2,
  MessageSquare,
  Package,
  Edit2,
  Plus,
  Minus,
  X,
  Copy,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

// ─── Types ────────────────────────────────────────────────────────────────────

type OrderStatus =
  | "new"
  | "confirmed"
  | "ready_for_delivery"
  | "in_courier"
  | "cancelled"
  | "hold"
  | "ship_later"
  | "paid"
  | "deleted"
  | "completed";

type SelectedStatus = "all" | OrderStatus;

interface ProductThumbnail {
  productId: Id<"products">;
  productName: string;
  imageUrl: string | null;
  quantity: number;
  size: string;
  color?: string;
  unitPrice: number;
  totalPrice: number;
}

interface EnrichedOrder {
  _id: Id<"orders">;
  _creationTime: number;
  userId?: Id<"users">;
  status: OrderStatus;
  total: number;
  subtotal: number;
  discountAmount: number;
  deliveryCost?: number;
  paymentMethod?: string;
  paymentStatus: "unpaid" | "paid" | "refunded";
  notes?: string;
  adminNote?: string;
  courierName?: string;
  shippingAddress: {
    name: string;
    phone: string;
    email?: string;
    address: string;
  };
  confirmedBy?: { userId: string; name: string; at: number };
  deletedBy?: { userId: string; name: string; at: number };
  cancelledBy?: { userId: string; name: string; at: number };
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  productThumbnails: ProductThumbnail[];
}

interface CurrentUser {
  role: "customer" | "admin" | "superadmin";
  permissions?: {
    orders?: {
      enabled: boolean;
      allowedStatuses: string[];
      canEdit: boolean;
      canDelete: boolean;
      canConfirm: boolean;
    };
    marketing: boolean;
    products: boolean;
    settings: boolean;
    pages: boolean;
    users: boolean;
  };
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<OrderStatus, string> = {
  new: "New Orders",
  confirmed: "Confirmed",
  ready_for_delivery: "Ready for Delivery",
  in_courier: "In-Courier",
  cancelled: "Cancelled",
  hold: "Hold",
  ship_later: "Ship Later",
  paid: "Paid",
  deleted: "Deleted",
  completed: "Completed",
};

const ORDER_STATUS_LIST: OrderStatus[] = [
  "new",
  "confirmed",
  "ready_for_delivery",
  "in_courier",
  "cancelled",
  "hold",
  "ship_later",
  "paid",
  "deleted",
  "completed",
];

// Statuses available in the dropdown (completed/deleted only via action buttons)
const DROPDOWN_STATUSES: OrderStatus[] = [
  "new",
  "confirmed",
  "ready_for_delivery",
  "in_courier",
  "cancelled",
  "hold",
  "ship_later",
  "paid",
];

// Statuses excluded from "All" tab
const EXCLUDED_FROM_ALL: OrderStatus[] = ["completed", "deleted"];

// Tab active/inactive colors per status
const TAB_COLORS: Record<
  "all" | OrderStatus,
  { active: string; inactive: string; dot: string }
> = {
  all: {
    active: "bg-emerald-600 text-white",
    inactive: "border border-emerald-600 text-emerald-700 bg-white dark:bg-background",
    dot: "bg-emerald-600",
  },
  new: {
    active: "bg-blue-600 text-white",
    inactive: "border border-blue-600 text-blue-700 bg-white dark:bg-background",
    dot: "bg-blue-600",
  },
  confirmed: {
    active: "bg-teal-600 text-white",
    inactive: "border border-teal-600 text-teal-700 bg-white dark:bg-background",
    dot: "bg-teal-600",
  },
  ready_for_delivery: {
    active: "bg-orange-500 text-white",
    inactive: "border border-orange-500 text-orange-600 bg-white dark:bg-background",
    dot: "bg-orange-500",
  },
  in_courier: {
    active: "bg-yellow-500 text-white",
    inactive: "border border-yellow-600 text-yellow-700 bg-white dark:bg-background",
    dot: "bg-yellow-500",
  },
  cancelled: {
    active: "bg-red-600 text-white",
    inactive: "border border-red-600 text-red-700 bg-white dark:bg-background",
    dot: "bg-red-600",
  },
  hold: {
    active: "bg-purple-600 text-white",
    inactive: "border border-purple-600 text-purple-700 bg-white dark:bg-background",
    dot: "bg-purple-600",
  },
  ship_later: {
    active: "bg-pink-500 text-white",
    inactive: "border border-pink-500 text-pink-600 bg-white dark:bg-background",
    dot: "bg-pink-500",
  },
  paid: {
    active: "bg-emerald-500 text-white",
    inactive: "border border-emerald-500 text-emerald-600 bg-white dark:bg-background",
    dot: "bg-emerald-500",
  },
  deleted: {
    active: "bg-gray-500 text-white",
    inactive: "border border-gray-500 text-gray-600 bg-white dark:bg-background",
    dot: "bg-gray-500",
  },
  completed: {
    active: "bg-green-700 text-white",
    inactive: "border border-green-700 text-green-800 bg-white dark:bg-background",
    dot: "bg-green-700",
  },
};

// ─── Helper functions ─────────────────────────────────────────────────────────

function formatOrderId(id: string): string {
  return "ORDER" + id.slice(-6).toUpperCase();
}

function formatDate(timestamp: number): string {
  const d = new Date(timestamp);
  const day = String(d.getDate()).padStart(2, "0");
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  const month = months[d.getMonth()];
  const year = d.getFullYear();
  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  if (hours === 0) hours = 12;
  return `${day} ${month} ${year} at ${hours}:${minutes} ${ampm}`;
}

function formatAmount(amount: number): string {
  return "Tk " + amount.toLocaleString("en-BD");
}

function getInitialLetter(name: string): string {
  return name.charAt(0).toUpperCase();
}

const AVATAR_COLORS = [
  "bg-blue-400", "bg-purple-400", "bg-green-400", "bg-orange-400",
  "bg-pink-400", "bg-teal-400", "bg-red-400", "bg-yellow-400",
];
function colorFromName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

// ─── ProductDetailsDialog ─────────────────────────────────────────────────────

interface ProductDetailsDialogProps {
  open: boolean;
  onClose: () => void;
  thumbnails: ProductThumbnail[];
}

function ProductDetailsDialog({ open, onClose, thumbnails }: ProductDetailsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Order Items</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {thumbnails.map((item, idx) => (
            <div key={idx} className="flex items-center gap-3 py-2">
              <div className="w-12 h-12 rounded-lg overflow-hidden border flex-shrink-0 bg-muted flex items-center justify-center">
                {item.imageUrl ? (
                  <img src={item.imageUrl} alt={item.productName} className="w-full h-full object-cover" />
                ) : (
                  <span className={`w-full h-full flex items-center justify-center text-white text-sm font-bold ${colorFromName(item.productName)}`}>
                    {getInitialLetter(item.productName)}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{item.productName}</p>
                <p className="text-xs text-muted-foreground">
                  {item.size}{item.color ? ` / ${item.color}` : ""}
                </p>
                <p className="text-xs text-muted-foreground">
                  {item.quantity} × {formatAmount(item.unitPrice)} = <span className="font-medium text-foreground">{formatAmount(item.totalPrice)}</span>
                </p>
              </div>
            </div>
          ))}
        </div>
        <DialogFooter showCloseButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── CustomerDetailsDialog ────────────────────────────────────────────────────

interface CustomerDetailsDialogProps {
  open: boolean;
  onClose: () => void;
  userId: Id<"users"> | null;
  name: string;
  phone: string;
  email?: string;
  address?: EnrichedOrder["shippingAddress"];
}

function CustomerDetailsDialog({ open, onClose, userId, name, phone, email, address }: CustomerDetailsDialogProps) {
  const recentOrders = useQuery(
    api.orders.getOrdersByUserId,
    userId ? { userId } : "skip"
  );

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Customer Details</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Customer info */}
          <div className="space-y-1.5">
            <p className="text-sm font-semibold text-foreground">{name || "—"}</p>
            {phone && <p className="text-sm text-muted-foreground">{phone}</p>}
            {email && <p className="text-sm text-muted-foreground">{email}</p>}
          </div>

          {/* Address */}
          {address && (
            <div className="text-sm text-muted-foreground space-y-0.5 border rounded p-3 bg-muted/30">
              <p className="font-medium text-foreground text-xs uppercase tracking-wide mb-1">Address</p>
              <p>{address.address}</p>
            </div>
          )}

          {/* Recent orders */}
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">Recent Orders</p>
            {recentOrders === undefined ? (
              <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
            ) : recentOrders.length === 0 ? (
              <p className="text-sm text-muted-foreground">No orders found.</p>
            ) : (
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {recentOrders.map((o) => (
                  <div key={o._id} className="flex items-center justify-between text-sm py-1.5 border-b last:border-0">
                    <span className="font-mono text-xs text-muted-foreground">{formatOrderId(o._id)}</span>
                    <span className="text-xs">{formatAmount(o.total)}</span>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">{STATUS_LABELS[o.status as OrderStatus]}</Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <DialogFooter showCloseButton />
      </DialogContent>
    </Dialog>
  );
}

// ─── NotePopover ──────────────────────────────────────────────────────────────

interface NotePopoverProps {
  orderId: Id<"orders">;
  customerNote?: string;
  adminNote?: string;
}

function NotePopover({ orderId, customerNote, adminNote }: NotePopoverProps) {
  const [open, setOpen] = useState(false);
  const [noteText, setNoteText] = useState(adminNote ?? "");
  const [saving, setSaving] = useState(false);
  const updateAdminNote = useMutation(api.orders.updateAdminNote);

  async function handleSave() {
    setSaving(true);
    try {
      await updateAdminNote({ orderId, adminNote: noteText });
      toast.success("Note saved");
      setOpen(false);
    } catch {
      toast.error("Failed to save note");
    } finally {
      setSaving(false);
    }
  }

  const hasNote = Boolean(adminNote);

  return (
    <Popover open={open} onOpenChange={(v) => {
      setOpen(v);
      if (v) setNoteText(adminNote ?? "");
    }}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 relative"
          title="Admin note"
        >
          <MessageSquare className="h-3.5 w-3.5" />
          {hasNote && (
            <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-[9px] rounded-full w-3.5 h-3.5 flex items-center justify-center">
              !
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3 space-y-3" align="end">
        {customerNote && (
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Customer Note</Label>
            <p className="text-sm bg-muted/50 rounded p-2">{customerNote}</p>
          </div>
        )}
        <div className="space-y-1.5">
          <Label className="text-xs">Admin Note</Label>
          <Textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Add an internal note…"
            rows={3}
            className="resize-none text-sm"
          />
        </div>
        <Button size="sm" className="w-full" onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
          Save Note
        </Button>
      </PopoverContent>
    </Popover>
  );
}

// ─── ConfirmDialog ────────────────────────────────────────────────────────────

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  onConfirm: () => Promise<void>;
  confirmLabel: string;
  confirmVariant?: "default" | "destructive";
}

function ConfirmDialog({
  open,
  onClose,
  title,
  description,
  onConfirm,
  confirmLabel,
  confirmVariant = "default",
}: ConfirmDialogProps) {
  const [loading, setLoading] = useState(false);

  async function handleConfirm() {
    setLoading(true);
    try {
      await onConfirm();
      onClose();
    } catch {
      toast.error("Action failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant={confirmVariant}
            onClick={(e) => { e.preventDefault(); handleConfirm(); }}
            disabled={loading}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ─── EditOrderDialog ──────────────────────────────────────────────────────────

interface EditOrderDialogProps {
  open: boolean;
  onClose: () => void;
  order: EnrichedOrder;
}

function EditOrderDialog({ open, onClose, order }: EditOrderDialogProps) {
  // ── Section A: Customer Info ──
  const [name, setName] = useState(order.shippingAddress.name);
  const [phone, setPhone] = useState(order.shippingAddress.phone);
  const [email, setEmail] = useState(order.shippingAddress.email ?? "");
  const [address, setAddress] = useState(order.shippingAddress.address);
  const [savingCustomer, setSavingCustomer] = useState(false);

  // ── Section B: Products ──
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProductId, setSelectedProductId] = useState<Id<"products"> | null>(null);
  const [selectedVariantId, setSelectedVariantId] = useState<Id<"productVariants"> | null>(null);
  const [addQty, setAddQty] = useState(1);
  const [addingProduct, setAddingProduct] = useState(false);
  const [removeItemId, setRemoveItemId] = useState<Id<"orderItems"> | null>(null);

  // ── Section C: Pricing ──
  const [deliveryCost, setDeliveryCost] = useState<number>(order.deliveryCost ?? 0);
  const [discount, setDiscount] = useState<number>(order.discountAmount ?? 0);
  const [paymentMethod, setPaymentMethod] = useState<string>(order.paymentMethod ?? "cod");
  const [savingPricing, setSavingPricing] = useState(false);
  const [paymentLink, setPaymentLink] = useState<string | null>(null);
  const [generatingLink, setGeneratingLink] = useState(false);

  const updateSnapshot = useMutation(api.orders.updateOrderSnapshot);
  const updateItem = useMutation(api.orders.updateOrderItem);
  const removeItem = useMutation(api.orders.removeOrderItem);
  const addItem = useMutation(api.orders.addOrderItem);
  const updatePricing = useMutation(api.orders.updateOrderPricing);
  const generatePaymentLink = useAction(api.paymentActions.generateAdminPaymentLink);

  // Fetch live order data
  const orderData = useQuery(api.orders.getById, open ? { orderId: order._id } : "skip");
  const advancePaid = useQuery(api.orders.getAdvancePaid, open ? { orderId: order._id } : "skip");

  // Product search
  const searchResults = useQuery(
    api.products.searchForAdmin,
    showAddProduct && searchTerm.trim() ? { query: searchTerm } : "skip"
  );

  // Sync delivery cost + discount when live data loads
  const liveOrder = orderData?.order;
  const liveItems = orderData?.items ?? [];

  useEffect(() => {
    if (!liveOrder) return;
    setDeliveryCost(liveOrder.deliveryCost ?? 0);
    setDiscount(liveOrder.discountAmount ?? 0);
    setPaymentMethod(liveOrder.paymentMethod ?? "cod");
  }, [liveOrder?._id]);

  const subtotal = liveOrder?.subtotal ?? order.subtotal;
  const advancePaidAmount = advancePaid ?? 0;
  const due = subtotal + deliveryCost - discount - advancePaidAmount;

  async function handleSaveCustomer() {
    setSavingCustomer(true);
    try {
      await updateSnapshot({
        orderId: order._id,
        name,
        phone,
        email: email.trim() || undefined,
        address,
      });
      toast.success("Customer info saved");
    } catch {
      toast.error("Failed to save customer info");
    } finally {
      setSavingCustomer(false);
    }
  }

  async function handleUpdateItemQty(
    itemId: Id<"orderItems">,
    variantId: Id<"productVariants">,
    newQty: number
  ) {
    if (newQty < 1) return;
    try {
      await updateItem({ orderId: order._id, itemId, variantId, quantity: newQty });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(msg.includes("Insufficient") ? "Insufficient stock" : "Failed to update quantity");
    }
  }

  async function handleRemoveItem(itemId: Id<"orderItems">) {
    try {
      await removeItem({ orderId: order._id, itemId });
      setRemoveItemId(null);
      toast.success("Item removed");
    } catch {
      toast.error("Failed to remove item");
    }
  }

  async function handleAddProduct() {
    if (!selectedProductId || !selectedVariantId) {
      toast.error("Select a product and variant first");
      return;
    }
    setAddingProduct(true);
    try {
      await addItem({
        orderId: order._id,
        productId: selectedProductId,
        variantId: selectedVariantId,
        quantity: addQty,
      });
      toast.success("Product added");
      setShowAddProduct(false);
      setSearchTerm("");
      setSelectedProductId(null);
      setSelectedVariantId(null);
      setAddQty(1);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(msg.includes("Insufficient") ? "Insufficient stock" : "Failed to add product");
    } finally {
      setAddingProduct(false);
    }
  }

  async function handleSavePricing() {
    setSavingPricing(true);
    try {
      await updatePricing({
        orderId: order._id,
        deliveryCost,
        discountAmount: discount,
        paymentMethod: paymentMethod || undefined,
      });
      toast.success("Pricing saved");
      setPaymentLink(null);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(msg || "Failed to save pricing");
    } finally {
      setSavingPricing(false);
    }
  }

  async function handleGeneratePaymentLink() {
    setGeneratingLink(true);
    try {
      const result = await generatePaymentLink({ orderId: order._id, dueAmount: due });
      setPaymentLink(result.GatewayPageURL);
    } catch {
      toast.error("Failed to generate payment link");
    } finally {
      setGeneratingLink(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Order — {formatOrderId(order._id)}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 pb-2">

          {/* ── Section A: Customer Info ── */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Customer Info</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="edit-name" className="text-xs">Name</Label>
                <Input
                  id="edit-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-phone" className="text-xs">Phone</Label>
                <Input
                  id="edit-phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-email" className="text-xs">Email <span className="text-muted-foreground">(optional)</span></Label>
              <Input
                id="edit-email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-8 text-sm"
                placeholder="customer@example.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-address" className="text-xs">Address</Label>
              <Textarea
                id="edit-address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                rows={2}
                className="resize-none text-sm"
                placeholder="Full delivery address"
              />
            </div>
            <Button size="sm" onClick={handleSaveCustomer} disabled={savingCustomer}>
              {savingCustomer ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
              Save Customer Info
            </Button>
          </div>

          <hr className="border-border" />

          {/* ── Section B: Products ── */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Products</h3>

            {/* Current items */}
            {liveItems.length === 0 && orderData === undefined && (
              <div className="flex justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            )}
            <div className="space-y-2">
              {liveItems.map((item) => (
                <div key={item._id} className="flex items-center gap-2 p-2 border rounded-md bg-muted/20">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.productName}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.color ? `${item.color} / ` : ""}{item.size} · {formatAmount(item.unitPrice)} each
                    </p>
                  </div>
                  {/* Qty controls */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => handleUpdateItemQty(item._id, item.variantId, item.quantity - 1)}
                      disabled={item.quantity <= 1}
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="w-6 text-center text-sm font-medium">{item.quantity}</span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => handleUpdateItemQty(item._id, item.variantId, item.quantity + 1)}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                  <p className="text-sm font-semibold w-20 text-right flex-shrink-0">
                    {formatAmount(item.totalPrice)}
                  </p>
                  {/* Delete */}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-red-500 hover:text-red-600 hover:bg-red-50 flex-shrink-0"
                    onClick={() => setRemoveItemId(item._id)}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>

            {/* Add product toggle */}
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => setShowAddProduct((v) => !v)}
            >
              {showAddProduct ? (
                <><ChevronUp className="h-3.5 w-3.5 mr-1.5" />Hide Product Search</>
              ) : (
                <><Plus className="h-3.5 w-3.5 mr-1.5" />Choose Another Product</>
              )}
            </Button>

            {/* Add product inline panel */}
            {showAddProduct && (
              <div className="border rounded-md p-3 space-y-3 bg-muted/10">
                <Input
                  placeholder="Search products..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setSelectedProductId(null);
                    setSelectedVariantId(null);
                  }}
                  className="h-8 text-sm"
                />
                {searchTerm.trim() && searchResults === undefined && (
                  <div className="flex justify-center py-2">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                )}
                {searchResults && searchResults.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-2">No products found</p>
                )}
                {searchResults && searchResults.length > 0 && (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {searchResults.map((product) => (
                      <div
                        key={product._id}
                        className={`p-2 border rounded cursor-pointer transition-colors ${
                          selectedProductId === product._id
                            ? "border-primary bg-primary/5"
                            : "hover:bg-muted/40"
                        }`}
                        onClick={() => {
                          setSelectedProductId(product._id);
                          setSelectedVariantId(null);
                        }}
                      >
                        <p className="text-sm font-medium">{product.name}</p>
                        <p className="text-xs text-muted-foreground">{formatAmount(product.basePrice)}</p>
                        {/* Variant chips */}
                        {selectedProductId === product._id && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {product.variants.map((variant) => (
                              <button
                                key={variant._id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedVariantId(variant._id);
                                }}
                                className={`px-2 py-0.5 text-xs rounded-full border transition-colors ${
                                  selectedVariantId === variant._id
                                    ? "bg-primary text-primary-foreground border-primary"
                                    : variant.stock <= 0
                                    ? "border-gray-200 text-gray-400 cursor-not-allowed"
                                    : "border-gray-300 hover:border-primary"
                                }`}
                                disabled={variant.stock <= 0}
                                title={variant.stock <= 0 ? "Out of stock" : `Stock: ${variant.stock}`}
                              >
                                {variant.color ? `${variant.color} / ` : ""}{variant.size}
                                {variant.stock <= 0 && " (OOS)"}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {selectedProductId && selectedVariantId && (
                  <div className="flex items-center gap-2">
                    <Label className="text-xs">Qty:</Label>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => setAddQty((q) => Math.max(1, q - 1))}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-8 text-center text-sm">{addQty}</span>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => setAddQty((q) => q + 1)}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                    <Button
                      size="sm"
                      className="ml-auto"
                      onClick={handleAddProduct}
                      disabled={addingProduct}
                    >
                      {addingProduct ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
                      Add
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>

          <hr className="border-border" />

          {/* ── Section C: Pricing & Payment ── */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Pricing & Payment</h3>

            <div className="space-y-2">
              {/* Subtotal — read-only */}
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium">{formatAmount(subtotal)}</span>
              </div>

              {/* Delivery cost — editable */}
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground w-32 flex-shrink-0">Delivery Cost</span>
                <Input
                  type="number"
                  min={0}
                  value={deliveryCost}
                  onChange={(e) => setDeliveryCost(Math.max(0, Number(e.target.value)))}
                  className="h-7 text-sm w-32"
                />
              </div>

              {/* Discount — editable */}
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground w-32 flex-shrink-0">Discount</span>
                <Input
                  type="number"
                  min={0}
                  value={discount}
                  onChange={(e) => setDiscount(Math.max(0, Number(e.target.value)))}
                  className="h-7 text-sm w-32"
                />
              </div>

              <hr className="border-border my-1" />

              {/* Advance Paid — read-only */}
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Advance Paid</span>
                <span className="font-medium text-green-600">{formatAmount(advancePaidAmount)}</span>
              </div>

              {/* Due — read-only, calculated */}
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold">Due</span>
                <span className="font-bold text-base">{formatAmount(Math.max(0, due))}</span>
              </div>
            </div>

            {/* Payment method */}
            <div className="space-y-1.5">
              <Label className="text-xs">Payment Method</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cod" className="text-sm">Cash on Delivery</SelectItem>
                  <SelectItem value="online" className="text-sm">Online Payment</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button size="sm" onClick={handleSavePricing} disabled={savingPricing}>
              {savingPricing ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
              Save Pricing
            </Button>

            {/* Generate Payment Link — only if Online Payment AND due > 0 */}
            {paymentMethod === "online" && due > 0 && (
              <div className="space-y-2 pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleGeneratePaymentLink}
                  disabled={generatingLink}
                >
                  {generatingLink ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
                  Generate Payment Link
                </Button>
                {paymentLink && (
                  <div className="flex items-center gap-2">
                    <Input
                      readOnly
                      value={paymentLink}
                      className="h-7 text-xs font-mono"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 flex-shrink-0"
                      onClick={() => {
                        navigator.clipboard.writeText(paymentLink);
                        toast.success("Copied!");
                      }}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Remove Item Confirmation */}
        <AlertDialog open={removeItemId !== null} onOpenChange={(v) => { if (!v) setRemoveItemId(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove Item?</AlertDialogTitle>
              <AlertDialogDescription>
                This will remove the item from the order and restore stock.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={(e) => {
                  e.preventDefault();
                  if (removeItemId) handleRemoveItem(removeItemId);
                }}
              >
                Remove
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}

// ─── OrderRow ─────────────────────────────────────────────────────────────────

interface OrderRowProps {
  order: EnrichedOrder;
  currentUser: CurrentUser | null;
  onUpdateStatus: (orderId: Id<"orders">, status: OrderStatus) => Promise<void>;
  onUpdateCourier: (orderId: Id<"orders">, courierName: string) => Promise<void>;
  courierEdits: Record<string, string>;
  setCourierEdit: (id: string, val: string) => void;
  onEditOpen: (orderId: Id<"orders">) => void;
}

function OrderRow({
  order,
  currentUser,
  onUpdateStatus,
  onUpdateCourier,
  courierEdits,
  setCourierEdit,
  onEditOpen,
}: OrderRowProps) {
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [customerDialogOpen, setCustomerDialogOpen] = useState(false);
  const [completedDialogOpen, setCompletedDialogOpen] = useState(false);
  const [deletedDialogOpen, setDeletedDialogOpen] = useState(false);
  const [editingCourier, setEditingCourier] = useState(false);

  const isSuperAdmin = currentUser?.role === "superadmin";
  const orderPerms = currentUser?.permissions?.orders;

  const canEdit = isSuperAdmin || (orderPerms?.canEdit === true);
  const canConfirm = isSuperAdmin || (orderPerms?.canConfirm === true);
  const canDelete = isSuperAdmin || (orderPerms?.canDelete === true);
  const allowedStatuses: string[] = isSuperAdmin
    ? DROPDOWN_STATUSES
    : (orderPerms?.allowedStatuses ?? []);

  const courierValue = order._id in courierEdits ? courierEdits[order._id] : (order.courierName ?? "");
  const collectable = order.total - (order.paymentStatus === "paid" ? order.total : 0);
  const paidAmount = order.paymentStatus === "paid" ? order.total : 0;
  const isOnlinePayment = order.paymentMethod && order.paymentMethod !== "cod";

  const statusColor = TAB_COLORS[order.status];
  const isTerminal = order.status === "completed" || order.status === "deleted";

  const customerDisplayName = order.shippingAddress.name || order.customerName || "—";
  const customerPhone = order.shippingAddress.phone || order.customerPhone || "—";

  // Filter dropdown statuses to allowed ones
  const visibleDropdownStatuses = DROPDOWN_STATUSES.filter((s) =>
    allowedStatuses.includes(s)
  );

  return (
    <>
      <TableRow className="align-top">
        {/* Order ID + Date */}
        <TableCell className="min-w-[140px]">
          <p className="font-mono text-xs font-semibold">{formatOrderId(order._id)}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">{formatDate(order._creationTime)}</p>
        </TableCell>

        {/* Customer Info — name is clickable */}
        <TableCell className="min-w-[150px]">
          <button
            onClick={() => setCustomerDialogOpen(true)}
            className="text-sm font-semibold hover:underline text-left focus:outline-none"
          >
            {customerDisplayName}
          </button>
          <p className="text-xs text-muted-foreground">{customerPhone}</p>
          <p className="text-xs text-muted-foreground">{order.shippingAddress.address?.split(",")[0]}</p>
        </TableCell>

        {/* Products */}
        <TableCell className="min-w-[100px]">
          <div className="flex items-center gap-1 flex-wrap">
            {order.productThumbnails.map((thumb, idx) => (
              <button
                key={idx}
                onClick={() => setProductDialogOpen(true)}
                className="w-8 h-8 rounded-full overflow-hidden border flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-ring"
                title={thumb.productName}
              >
                {thumb.imageUrl ? (
                  <img src={thumb.imageUrl} alt={thumb.productName} className="w-full h-full object-cover" />
                ) : (
                  <span className={`w-full h-full flex items-center justify-center text-white text-[10px] font-bold ${colorFromName(thumb.productName)}`}>
                    {getInitialLetter(thumb.productName)}
                  </span>
                )}
              </button>
            ))}
            {order.productThumbnails.length === 0 && (
              <span className="text-xs text-muted-foreground">—</span>
            )}
          </div>
        </TableCell>

        {/* Total Bill */}
        <TableCell className="min-w-[100px]">
          <p className="text-sm font-bold">{formatAmount(order.total)}</p>
        </TableCell>

        {/* Payment Info */}
        <TableCell className="min-w-[110px]">
          {paidAmount > 0 ? (
            <p className="text-xs font-medium text-green-600">Paid: {formatAmount(paidAmount)}</p>
          ) : (
            <p className="text-xs text-muted-foreground">Paid: 0 TK</p>
          )}
          <Badge
            variant="outline"
            className={`text-[10px] mt-0.5 px-1.5 py-0 ${isOnlinePayment ? "border-blue-400 text-blue-600" : "border-gray-400 text-gray-600"}`}
          >
            {isOnlinePayment ? "Online" : "COD"}
          </Badge>
        </TableCell>

        {/* Collectable */}
        <TableCell className="min-w-[100px]">
          <p className="text-sm font-semibold">{formatAmount(collectable)}</p>
        </TableCell>

        {/* Status — dropdown filtered by permissions */}
        <TableCell className="min-w-[160px]">
          <Select
            value={order.status}
            onValueChange={(val) => onUpdateStatus(order._id, val as OrderStatus)}
          >
            <SelectTrigger size="sm" className="h-7 text-xs w-full">
              <SelectValue>
                <span className="flex items-center gap-1.5">
                  <span className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${statusColor.dot}`} />
                  {STATUS_LABELS[order.status]}
                </span>
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {/* Always show current status first if it's a terminal one */}
              {isTerminal && (
                <SelectItem value={order.status} className="text-xs">
                  <span className="flex items-center gap-1.5">
                    <span className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${TAB_COLORS[order.status].dot}`} />
                    {STATUS_LABELS[order.status]}
                  </span>
                </SelectItem>
              )}
              {visibleDropdownStatuses.map((s) => (
                <SelectItem key={s} value={s} className="text-xs">
                  <span className="flex items-center gap-1.5">
                    <span className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${TAB_COLORS[s].dot}`} />
                    {STATUS_LABELS[s]}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </TableCell>

        {/* Courier */}
        <TableCell className="min-w-[120px]">
          {editingCourier ? (
            <Input
              value={courierValue}
              autoFocus
              className="h-7 text-xs"
              onChange={(e) => setCourierEdit(order._id, e.target.value)}
              onBlur={async () => {
                setEditingCourier(false);
                await onUpdateCourier(order._id, courierValue);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === "Escape") {
                  (e.target as HTMLInputElement).blur();
                }
              }}
            />
          ) : (
            <button
              onClick={() => setEditingCourier(true)}
              className="text-xs text-left w-full hover:text-foreground transition-colors min-h-[28px] px-1"
            >
              {courierValue || <span className="text-muted-foreground">—</span>}
            </button>
          )}
        </TableCell>

        {/* Note popover */}
        <TableCell className="min-w-[70px]">
          <NotePopover
            orderId={order._id}
            customerNote={order.notes}
            adminNote={order.adminNote}
          />
        </TableCell>

        {/* Actions */}
        <TableCell className="min-w-[100px]">
          <div className="flex items-center gap-1 flex-wrap">
            {canEdit && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-blue-500 hover:text-blue-600 hover:bg-blue-50"
                onClick={() => onEditOpen(order._id)}
                title="Edit Order"
              >
                <Edit2 className="h-4 w-4" />
              </Button>
            )}
            {canConfirm && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                onClick={() => setCompletedDialogOpen(true)}
                title="Mark as Completed"
              >
                <CheckCircle className="h-4 w-4" />
              </Button>
            )}
            {canDelete && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-red-500 hover:text-red-600 hover:bg-red-50"
                onClick={() => setDeletedDialogOpen(true)}
                title="Move to Deleted"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Audit trail */}
          {order.confirmedBy && (
            <p className="text-xs text-muted-foreground mt-1">
              Confirmed by {order.confirmedBy.name} · {new Date(order.confirmedBy.at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
            </p>
          )}
          {order.deletedBy && (
            <p className="text-xs text-muted-foreground mt-1">
              Deleted by {order.deletedBy.name} · {new Date(order.deletedBy.at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
            </p>
          )}
          {order.cancelledBy && (
            <p className="text-xs text-muted-foreground mt-1">
              Cancelled by {order.cancelledBy.name} · {new Date(order.cancelledBy.at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
            </p>
          )}
        </TableCell>
      </TableRow>

      {/* Product Details Dialog */}
      <ProductDetailsDialog
        open={productDialogOpen}
        onClose={() => setProductDialogOpen(false)}
        thumbnails={order.productThumbnails}
      />

      {/* Customer Details Dialog */}
      <CustomerDetailsDialog
        open={customerDialogOpen}
        onClose={() => setCustomerDialogOpen(false)}
        userId={order.userId ?? null}
        name={customerDisplayName}
        phone={customerPhone}
        email={order.customerEmail}
        address={order.shippingAddress}
      />

      {/* Completed Confirm Dialog */}
      <ConfirmDialog
        open={completedDialogOpen}
        onClose={() => setCompletedDialogOpen(false)}
        title="Mark as Completed?"
        description="This action will change the order status."
        onConfirm={() => onUpdateStatus(order._id, "completed")}
        confirmLabel="Confirm"
      />

      {/* Deleted Confirm Dialog */}
      <ConfirmDialog
        open={deletedDialogOpen}
        onClose={() => setDeletedDialogOpen(false)}
        title="Move to Deleted?"
        description="This action will change the order status."
        onConfirm={() => onUpdateStatus(order._id, "deleted")}
        confirmLabel="Delete"
        confirmVariant="destructive"
      />
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdminOrdersPage() {
  const [selectedStatus, setSelectedStatus] = useState<SelectedStatus>("all");
  const [courierEdits, setCourierEditsState] = useState<Record<string, string>>({});
  const [editOrderId, setEditOrderId] = useState<Id<"orders"> | null>(null);

  const { results, status, loadMore } = usePaginatedQuery(
    api.orders.listAllEnriched,
    {
      status: selectedStatus === "all" ? undefined : selectedStatus,
      excludeStatuses: selectedStatus === "all" ? EXCLUDED_FROM_ALL : undefined,
    },
    { initialNumItems: 25 }
  );

  const statusCounts = useQuery(api.orders.getStatusCounts);
  const updateStatus = useMutation(api.orders.updateStatus);
  const updateCourier = useMutation(api.orders.updateCourier);
  const currentUser = useQuery(api.users.getCurrentUserWithRole);

  // "All" tab counts exclude completed/deleted
  const excludedSet = new Set(EXCLUDED_FROM_ALL);
  const allCount = statusCounts?.filter((s) => !excludedSet.has(s.status as OrderStatus)).reduce((sum, s) => sum + s.count, 0) ?? 0;
  const allAmount = statusCounts?.filter((s) => !excludedSet.has(s.status as OrderStatus)).reduce((sum, s) => sum + s.totalAmount, 0) ?? 0;

  function getTabCount(s: OrderStatus): number {
    return statusCounts?.find((c) => c.status === s)?.count ?? 0;
  }

  function getTabAmount(s: OrderStatus): number {
    return statusCounts?.find((c) => c.status === s)?.totalAmount ?? 0;
  }

  function setCourierEdit(id: string, val: string) {
    setCourierEditsState((prev) => ({ ...prev, [id]: val }));
  }

  async function handleUpdateStatus(orderId: Id<"orders">, newStatus: OrderStatus) {
    try {
      await updateStatus({ orderId, status: newStatus });
      toast.success("Status updated");
    } catch {
      toast.error("Failed to update status");
    }
  }

  async function handleUpdateCourier(orderId: Id<"orders">, courierName: string) {
    try {
      await updateCourier({ orderId, courierName });
    } catch {
      toast.error("Failed to update courier");
    }
  }

  const orders = results as EnrichedOrder[];
  const editOrder = editOrderId ? orders.find((o) => o._id === editOrderId) ?? null : null;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold">Orders</h1>
      </div>

      {/* Tab Bar */}
      <div className="overflow-x-auto scrollbar-hide">
        <div className="flex items-center gap-2 pb-1" style={{ minWidth: "max-content" }}>
          {/* All tab */}
          <button
            onClick={() => setSelectedStatus("all")}
            className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
              selectedStatus === "all"
                ? TAB_COLORS.all.active
                : `${TAB_COLORS.all.inactive} font-medium`
            }`}
          >
            All: {allCount}
            {selectedStatus === "all" && allAmount > 0 && ` (Tk ${allAmount.toLocaleString("en-BD")})`}
          </button>

          {/* Status tabs */}
          {ORDER_STATUS_LIST.map((s) => {
            const count = getTabCount(s);
            const amount = getTabAmount(s);
            const isActive = selectedStatus === s;
            const colors = TAB_COLORS[s];
            return (
              <button
                key={s}
                onClick={() => setSelectedStatus(s)}
                className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs transition-colors ${
                  isActive ? `${colors.active} font-semibold` : `${colors.inactive} font-medium`
                }`}
              >
                {STATUS_LABELS[s]}: {count}
                {isActive && amount > 0 && ` (Tk ${amount.toLocaleString("en-BD")})`}
              </button>
            );
          })}
        </div>
      </div>

      {/* Table */}
      <div className="border rounded overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="text-xs">
              <TableHead>Order ID</TableHead>
              <TableHead>Customer Info</TableHead>
              <TableHead>Products</TableHead>
              <TableHead>Total Bill</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead>Collectable</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Courier</TableHead>
              <TableHead>Note</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {status === "LoadingFirstPage" ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : orders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-12">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Package className="h-8 w-8" />
                    <p className="text-sm">No orders found</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              orders.map((order) => (
                <OrderRow
                  key={order._id}
                  order={order}
                  currentUser={currentUser ?? null}
                  onUpdateStatus={handleUpdateStatus}
                  onUpdateCourier={handleUpdateCourier}
                  courierEdits={courierEdits}
                  setCourierEdit={setCourierEdit}
                  onEditOpen={(id) => setEditOrderId(id)}
                />
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Load More */}
      {status === "CanLoadMore" && (
        <div className="flex justify-center pt-2">
          <Button
            variant="outline"
            onClick={() => loadMore(25)}
            disabled={status !== "CanLoadMore"}
          >
            Load More
          </Button>
        </div>
      )}

      {/* Edit Order Dialog — rendered at page level */}
      {editOrder && (
        <EditOrderDialog
          open={editOrderId !== null}
          onClose={() => setEditOrderId(null)}
          order={editOrder}
        />
      )}
    </div>
  );
}
