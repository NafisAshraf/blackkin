"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { usePaginatedQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
  Loader2,
  Plus,
  Pencil,
  TicketPercent,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Gift,
  Globe,
  Lock,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

type DiscountType = "flat" | "percentage";

type VoucherFormData = {
  code: string;
  description: string;
  discountType: DiscountType;
  discountAmount: string;
  maxDiscountAmount: string;
  isGlobal: boolean;
  minSpend: string;
  expiresAt: string;
  maxUses: string;
  maxUsesPerCustomer: string;
  isActive: boolean;
};

const EMPTY_FORM: VoucherFormData = {
  code: "",
  description: "",
  discountType: "flat",
  discountAmount: "",
  maxDiscountAmount: "",
  isGlobal: false,
  minSpend: "0",
  expiresAt: "",
  maxUses: "0",
  maxUsesPerCustomer: "1",
  isActive: true,
};

function toLocalDatetimeValue(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatDiscount(v: {
  discountType: DiscountType;
  discountAmount: number;
  maxDiscountAmount?: number;
}): string {
  if (v.discountType === "percentage") {
    return `${v.discountAmount}%${v.maxDiscountAmount ? ` (max ৳${v.maxDiscountAmount.toLocaleString()})` : ""}`;
  }
  return `৳${v.discountAmount.toLocaleString()}`;
}

// --- WELCOME VOUCHER SETTINGS CARD ---

type WelcomeFormState = {
  discountAmount: string;
  maxDiscountAmount: string;
  minSpend: string;
  description: string;
  isActive: boolean;
};

function WelcomeVoucherCard() {
  const { results: allVouchers } = usePaginatedQuery(
    api.vouchers.adminList,
    {},
    { initialNumItems: 100 },
  );
  const adminUpdateWelcome = useMutation(api.vouchers.adminUpdateWelcomeConfig);

  const welcome = allVouchers?.find((v) => v.code === "WELCOME");

  const [form, setForm] = useState<WelcomeFormState>({
    discountAmount: "",
    maxDiscountAmount: "",
    minSpend: "0",
    description: "",
    isActive: true,
  });
  const [initialized, setInitialized] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  if (welcome && !initialized) {
    setForm({
      discountAmount: String(welcome.discountAmount),
      maxDiscountAmount: welcome.maxDiscountAmount
        ? String(welcome.maxDiscountAmount)
        : "",
      minSpend: String(welcome.minSpend),
      description: welcome.description ?? "",
      isActive: welcome.isActive,
    });
    setInitialized(true);
  }

  function setWField<K extends keyof WelcomeFormState>(
    key: K,
    value: WelcomeFormState[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    const da = parseFloat(form.discountAmount);
    const mda = parseFloat(form.maxDiscountAmount);
    const ms = parseFloat(form.minSpend);
    if (isNaN(da) || da <= 0 || da > 100) {
      toast.error("Discount must be between 1 and 100%.");
      return;
    }
    if (isNaN(mda) || mda <= 0) {
      toast.error("Max discount amount must be a positive number.");
      return;
    }
    if (isNaN(ms) || ms < 0) {
      toast.error("Min spend cannot be negative.");
      return;
    }
    setIsSaving(true);
    try {
      await adminUpdateWelcome({
        discountAmount: da,
        maxDiscountAmount: mda,
        minSpend: ms,
        isActive: form.isActive,
        description: form.description.trim() || undefined,
      });
      toast.success("WELCOME voucher updated");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setIsSaving(false);
    }
  }

  const isSeeded = !!welcome;

  return (
    <div className="border rounded-lg p-5 space-y-4 bg-muted/20">
      <div className="flex items-start gap-3">
        <Gift className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-semibold text-sm">WELCOME — System Voucher</h2>
            {isSeeded ? (
              <Badge
                variant="outline"
                className={
                  welcome!.isActive
                    ? "text-green-600 border-green-300"
                    : "text-muted-foreground"
                }
              >
                {welcome!.isActive ? "Active" : "Inactive"}
              </Badge>
            ) : allVouchers !== undefined ? (
              <Badge
                variant="outline"
                className="text-amber-600 border-amber-300"
              >
                Pending seed (≤1 hr)
              </Badge>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Auto-seeded global voucher. Each customer can use it once. Cannot be
            deleted.
            {isSeeded && (
              <span className="ml-1">
                Used {welcome!.usedCount} time
                {welcome!.usedCount !== 1 ? "s" : ""} total.
              </span>
            )}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="w-discount">Discount (%)</Label>
          <Input
            id="w-discount"
            type="number"
            min="1"
            max="100"
            value={form.discountAmount}
            onChange={(e) => setWField("discountAmount", e.target.value)}
            placeholder="10"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="w-max">Max Discount (৳)</Label>
          <Input
            id="w-max"
            type="number"
            min="1"
            value={form.maxDiscountAmount}
            onChange={(e) => setWField("maxDiscountAmount", e.target.value)}
            placeholder="100"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="w-min">Min Spend (৳)</Label>
          <Input
            id="w-min"
            type="number"
            min="0"
            value={form.minSpend}
            onChange={(e) => setWField("minSpend", e.target.value)}
            placeholder="0"
          />
          <p className="text-xs text-muted-foreground">0 = no minimum</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="w-desc">Description</Label>
          <Input
            id="w-desc"
            value={form.description}
            onChange={(e) => setWField("description", e.target.value)}
            placeholder="Welcome gift for new customers"
          />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(e) => setWField("isActive", e.target.checked)}
            className="h-4 w-4 rounded border-border accent-foreground"
          />
          <span className="text-sm">Active</span>
        </label>
        <Button size="sm" onClick={handleSave} disabled={isSaving}>
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              Saving...
            </>
          ) : (
            "Save"
          )}
        </Button>
      </div>
    </div>
  );
}

// --- MAIN PAGE ---

export default function VouchersPage() {
  const {
    results: vouchers,
    loadMore,
    status,
  } = usePaginatedQuery(api.vouchers.adminList, {}, { initialNumItems: 25 });

  const adminCreate = useMutation(api.vouchers.adminCreate);
  const adminUpdate = useMutation(api.vouchers.adminUpdate);
  const adminToggle = useMutation(api.vouchers.adminToggleActive);
  const adminDelete = useMutation(api.vouchers.adminDelete);

  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<Id<"vouchers"> | null>(null);
  const [deletingId, setDeletingId] = useState<Id<"vouchers"> | null>(null);
  const [form, setForm] = useState<VoucherFormData>(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<Id<"vouchers"> | null>(null);

  const editingVoucher = vouchers?.find((v) => v._id === editingId);

  function openCreate() {
    setForm(EMPTY_FORM);
    setIsCreating(true);
  }

  function openEdit(v: NonNullable<typeof vouchers>[number]) {
    setForm({
      code: v.code,
      description: v.description ?? "",
      discountType: v.discountType,
      discountAmount: String(v.discountAmount),
      maxDiscountAmount: v.maxDiscountAmount ? String(v.maxDiscountAmount) : "",
      isGlobal: v.isGlobal,
      minSpend: String(v.minSpend),
      expiresAt: toLocalDatetimeValue(v.expiresAt),
      maxUses: String(v.maxUses),
      maxUsesPerCustomer: String(v.maxUsesPerCustomer),
      isActive: v.isActive,
    });
    setEditingId(v._id);
  }

  function closeDialog() {
    setIsCreating(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  function setField<K extends keyof VoucherFormData>(
    key: K,
    value: VoucherFormData[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function parseFormArgs() {
    const discountAmount = parseFloat(form.discountAmount);
    const minSpend = parseFloat(form.minSpend);
    const maxUses = parseInt(form.maxUses, 10);
    const maxUsesPerCustomer = parseInt(form.maxUsesPerCustomer, 10);
    const expiresAtMs = new Date(form.expiresAt).getTime();

    if (form.discountType === "flat") {
      if (isNaN(discountAmount) || discountAmount <= 0)
        throw new Error("Discount amount must be a positive number.");
    } else {
      if (isNaN(discountAmount) || discountAmount <= 0 || discountAmount > 100)
        throw new Error("Percentage discount must be between 1 and 100.");
      const maxDA = parseFloat(form.maxDiscountAmount);
      if (isNaN(maxDA) || maxDA <= 0)
        throw new Error(
          "Max discount amount (BDT cap) is required for percentage vouchers.",
        );
    }
    if (isNaN(minSpend) || minSpend < 0)
      throw new Error("Minimum spend cannot be negative.");
    if (isNaN(maxUses) || maxUses < 0)
      throw new Error("Max uses cannot be negative.");
    if (isNaN(maxUsesPerCustomer) || maxUsesPerCustomer < 0)
      throw new Error("Max uses per customer cannot be negative.");
    if (isNaN(expiresAtMs)) throw new Error("Please select a valid expiry date.");
    if (expiresAtMs <= Date.now())
      throw new Error("Expiry date must be in the future.");

    return {
      discountAmount,
      maxDiscountAmount:
        form.discountType === "percentage"
          ? parseFloat(form.maxDiscountAmount)
          : undefined,
      minSpend,
      maxUses,
      maxUsesPerCustomer,
      expiresAt: expiresAtMs,
    };
  }

  async function handleSave() {
    setIsSaving(true);
    try {
      const parsed = parseFormArgs();
      if (isCreating) {
        await adminCreate({
          code: form.code,
          description: form.description.trim() || undefined,
          discountType: form.discountType,
          discountAmount: parsed.discountAmount,
          maxDiscountAmount: parsed.maxDiscountAmount,
          isGlobal: form.isGlobal,
          minSpend: parsed.minSpend,
          expiresAt: parsed.expiresAt,
          maxUses: parsed.maxUses,
          maxUsesPerCustomer: parsed.maxUsesPerCustomer,
          isActive: form.isActive,
        });
        toast.success("Voucher created");
      } else if (editingId) {
        await adminUpdate({
          voucherId: editingId,
          description: form.description.trim() || undefined,
          discountType: form.discountType,
          discountAmount: parsed.discountAmount,
          maxDiscountAmount: parsed.maxDiscountAmount,
          isGlobal: form.isGlobal,
          minSpend: parsed.minSpend,
          expiresAt: parsed.expiresAt,
          maxUses: parsed.maxUses,
          maxUsesPerCustomer: parsed.maxUsesPerCustomer,
        });
        toast.success("Voucher updated");
      }
      closeDialog();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to save voucher");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleToggle(id: Id<"vouchers">) {
    setTogglingId(id);
    try {
      await adminToggle({ voucherId: id });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to toggle voucher");
    } finally {
      setTogglingId(null);
    }
  }

  const deletingVoucher = vouchers?.find((v) => v._id === deletingId);

  async function handleDelete() {
    if (!deletingId) return;
    try {
      await adminDelete({ voucherId: deletingId });
      toast.success("Voucher deleted");
      setDeletingId(null);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to delete voucher");
    }
  }

  // Exclude WELCOME from main table (managed via settings card)
  const regularVouchers = vouchers?.filter((v) => v.code !== "WELCOME") ?? [];

  return (
    <div className="space-y-6">
      {/* WELCOME system voucher card */}
      <WelcomeVoucherCard />

      <Separator />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Vouchers</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage discount codes for customers.
          </p>
        </div>
        <Button onClick={openCreate} className="gap-1.5">
          <Plus className="h-4 w-4" />
          New Voucher
        </Button>
      </div>

      {/* Table */}
      {vouchers === undefined ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : regularVouchers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center border rounded-lg">
          <TicketPercent className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-muted-foreground text-sm">No vouchers yet.</p>
          <Button
            variant="outline"
            className="mt-4 gap-1.5"
            onClick={openCreate}
          >
            <Plus className="h-4 w-4" />
            Create your first voucher
          </Button>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    Code
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    Discount
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    Min Spend
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    Expires
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    Uses
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    Per Customer
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    Visibility
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    Status
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {regularVouchers.map((v) => {
                  const isExpired = v.expiresAt <= Date.now();
                  const isExhausted = v.maxUses > 0 && v.usedCount >= v.maxUses;
                  const isEffectivelyInactive =
                    !v.isActive || isExpired || isExhausted;
                  return (
                    <tr
                      key={v._id}
                      className="hover:bg-muted/30 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <span className="font-mono font-semibold tracking-wider">
                          {v.code}
                        </span>
                        {v.description && (
                          <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[160px]">
                            {v.description}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 font-medium">
                        {formatDiscount(v)}
                      </td>
                      <td className="px-4 py-3">
                        {v.minSpend > 0 ? (
                          `৳${v.minSpend.toLocaleString()}`
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={isExpired ? "text-destructive" : ""}>
                          {format(new Date(v.expiresAt), "dd MMM yyyy, HH:mm")}
                        </span>
                        {isExpired && (
                          <p className="text-xs text-destructive">Expired</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={
                            isExhausted ? "text-destructive font-medium" : ""
                          }
                        >
                          {v.usedCount}
                          {v.maxUses > 0 ? ` / ${v.maxUses}` : " / ∞"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {v.maxUsesPerCustomer > 0 ? (
                          v.maxUsesPerCustomer
                        ) : (
                          <span className="text-muted-foreground">∞</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {v.isGlobal ? (
                          <span className="flex items-center gap-1 text-xs text-blue-600">
                            <Globe className="h-3.5 w-3.5" />
                            Global
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Lock className="h-3.5 w-3.5" />
                            Private
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {isEffectivelyInactive ? (
                          <Badge
                            variant="outline"
                            className="text-muted-foreground"
                          >
                            Inactive
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="text-green-600 border-green-300"
                          >
                            Active
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleToggle(v._id)}
                            disabled={togglingId === v._id}
                            className="h-8 w-8 flex items-center justify-center rounded hover:bg-muted transition-colors disabled:opacity-40"
                            title={v.isActive ? "Deactivate" : "Activate"}
                          >
                            {togglingId === v._id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : v.isActive ? (
                              <ToggleRight className="h-4 w-4 text-green-600" />
                            ) : (
                              <ToggleLeft className="h-4 w-4 text-muted-foreground" />
                            )}
                          </button>
                          <button
                            onClick={() => openEdit(v)}
                            className="h-8 w-8 flex items-center justify-center rounded hover:bg-muted transition-colors"
                            title="Edit"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => setDeletingId(v._id)}
                            className="h-8 w-8 flex items-center justify-center rounded hover:bg-destructive/10 transition-colors text-destructive"
                            title="Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {status === "CanLoadMore" && (
            <div className="flex justify-center p-4 border-t">
              <Button variant="outline" size="sm" onClick={() => loadMore(25)}>
                Load more
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog
        open={isCreating || !!editingId}
        onOpenChange={(open) => {
          if (!open) closeDialog();
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {isCreating ? "Create Voucher" : "Edit Voucher"}
            </DialogTitle>
            <DialogDescription>
              {isCreating
                ? "Create a new discount code for customers."
                : `Editing voucher: ${editingVoucher?.code ?? ""}`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {isCreating && (
              <div className="space-y-1.5">
                <Label htmlFor="v-code">Code *</Label>
                <Input
                  id="v-code"
                  value={form.code}
                  onChange={(e) =>
                    setField(
                      "code",
                      e.target.value.toUpperCase().replace(/\s/g, ""),
                    )
                  }
                  placeholder="e.g. SAVE100"
                  className="font-mono uppercase"
                />
                <p className="text-xs text-muted-foreground">
                  Customers will enter this at checkout.
                </p>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="v-desc">Description (optional)</Label>
              <Input
                id="v-desc"
                value={form.description}
                onChange={(e) => setField("description", e.target.value)}
                placeholder="e.g. Eid special offer"
              />
            </div>

            {/* Discount type selector */}
            <div className="space-y-1.5">
              <Label>Discount Type *</Label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setField("discountType", "flat")}
                  className={`flex-1 py-2 px-3 text-sm rounded border transition-colors ${
                    form.discountType === "flat"
                      ? "bg-foreground text-background border-foreground"
                      : "bg-background text-foreground border-border hover:bg-muted"
                  }`}
                >
                  Flat (৳)
                </button>
                <button
                  type="button"
                  onClick={() => setField("discountType", "percentage")}
                  className={`flex-1 py-2 px-3 text-sm rounded border transition-colors ${
                    form.discountType === "percentage"
                      ? "bg-foreground text-background border-foreground"
                      : "bg-background text-foreground border-border hover:bg-muted"
                  }`}
                >
                  Percentage (%)
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="v-discount">
                  {form.discountType === "flat"
                    ? "Discount (৳) *"
                    : "Discount (%) *"}
                </Label>
                <Input
                  id="v-discount"
                  type="number"
                  min="1"
                  max={form.discountType === "percentage" ? "100" : undefined}
                  value={form.discountAmount}
                  onChange={(e) => setField("discountAmount", e.target.value)}
                  placeholder={form.discountType === "flat" ? "100" : "25"}
                />
              </div>

              {form.discountType === "percentage" ? (
                <div className="space-y-1.5">
                  <Label htmlFor="v-max-discount">Max Discount (৳) *</Label>
                  <Input
                    id="v-max-discount"
                    type="number"
                    min="1"
                    value={form.maxDiscountAmount}
                    onChange={(e) =>
                      setField("maxDiscountAmount", e.target.value)
                    }
                    placeholder="200"
                  />
                  <p className="text-xs text-muted-foreground">BDT cap</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label htmlFor="v-min-flat">Min Spend (৳)</Label>
                  <Input
                    id="v-min-flat"
                    type="number"
                    min="0"
                    value={form.minSpend}
                    onChange={(e) => setField("minSpend", e.target.value)}
                    placeholder="0"
                  />
                  <p className="text-xs text-muted-foreground">0 = no minimum</p>
                </div>
              )}
            </div>

            {form.discountType === "percentage" && (
              <div className="space-y-1.5">
                <Label htmlFor="v-min-pct">Min Spend (৳)</Label>
                <Input
                  id="v-min-pct"
                  type="number"
                  min="0"
                  value={form.minSpend}
                  onChange={(e) => setField("minSpend", e.target.value)}
                  placeholder="0"
                />
                <p className="text-xs text-muted-foreground">0 = no minimum</p>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="v-expires">Expires At *</Label>
              <Input
                id="v-expires"
                type="datetime-local"
                value={form.expiresAt}
                onChange={(e) => setField("expiresAt", e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="v-max-uses">Max Uses (total)</Label>
                <Input
                  id="v-max-uses"
                  type="number"
                  min="0"
                  value={form.maxUses}
                  onChange={(e) => setField("maxUses", e.target.value)}
                  placeholder="0"
                />
                <p className="text-xs text-muted-foreground">0 = unlimited</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="v-per-customer">Per Customer</Label>
                <Input
                  id="v-per-customer"
                  type="number"
                  min="0"
                  value={form.maxUsesPerCustomer}
                  onChange={(e) =>
                    setField("maxUsesPerCustomer", e.target.value)
                  }
                  placeholder="1"
                />
                <p className="text-xs text-muted-foreground">0 = unlimited</p>
              </div>
            </div>

            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={form.isGlobal}
                  onChange={(e) => setField("isGlobal", e.target.checked)}
                  className="h-4 w-4 rounded border-border accent-foreground"
                />
                <span className="text-sm">
                  Global (visible in customer profiles)
                </span>
              </label>

              {isCreating && (
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) => setField("isActive", e.target.checked)}
                    className="h-4 w-4 rounded border-border accent-foreground"
                  />
                  <span className="text-sm">Active</span>
                </label>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isCreating ? "Creating..." : "Saving..."}
                </>
              ) : isCreating ? (
                "Create"
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deletingId}
        onOpenChange={(open) => {
          if (!open) setDeletingId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete voucher?</AlertDialogTitle>
            <AlertDialogDescription>
              {deletingVoucher?.usedCount ? (
                <span className="text-destructive">
                  This voucher has been used {deletingVoucher.usedCount} time(s)
                  and cannot be deleted. Deactivate it instead.
                </span>
              ) : (
                <>
                  Permanently delete{" "}
                  <span className="font-mono font-semibold">
                    {deletingVoucher?.code}
                  </span>
                  ? This action cannot be undone.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={!!deletingVoucher?.usedCount}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
