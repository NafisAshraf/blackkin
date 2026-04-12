"use client";

import { useState, useEffect } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";

function toDatetimeLocal(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromDatetimeLocal(val: string): number {
  return new Date(val).getTime();
}

interface DiscountGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editId?: Id<"discountGroups">;
  editData?: {
    name: string;
    discountType: "percentage" | "fixed";
    discountValue: number;
    startTime: number;
    endTime?: number;
    isActive: boolean;
  };
}

export function DiscountGroupDialog({
  open,
  onOpenChange,
  editId,
  editData,
}: DiscountGroupDialogProps) {
  const [name, setName] = useState("");
  const [discountType, setDiscountType] = useState<"percentage" | "fixed">("percentage");
  const [discountValue, setDiscountValue] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [indefinite, setIndefinite] = useState(true);
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  const createGroup = useMutation(api.discountGroups.create);
  const updateGroup = useMutation(api.discountGroups.update);

  const isEdit = !!editId;

  useEffect(() => {
    if (open) {
      if (editData) {
        setName(editData.name);
        setDiscountType(editData.discountType);
        setDiscountValue(editData.discountValue.toString());
        setStartTime(toDatetimeLocal(editData.startTime));
        setIndefinite(!editData.endTime);
        setEndTime(editData.endTime ? toDatetimeLocal(editData.endTime) : "");
        setIsActive(editData.isActive);
      } else {
        setName("");
        setDiscountType("percentage");
        setDiscountValue("");
        setStartTime(toDatetimeLocal(Date.now()));
        setIndefinite(true);
        setEndTime("");
        setIsActive(true);
      }
    }
  }, [open, editData]);

  async function handleSave() {
    if (!name.trim()) { toast.error("Group name is required"); return; }
    const val = Number(discountValue);
    if (!val || val <= 0) { toast.error("Enter a valid discount value"); return; }
    if (discountType === "percentage" && val > 100) { toast.error("Percentage cannot exceed 100%"); return; }
    if (!startTime) { toast.error("Start time is required"); return; }
    const startMs = fromDatetimeLocal(startTime);
    const endMs = !indefinite && endTime ? fromDatetimeLocal(endTime) : undefined;
    if (endMs && endMs <= startMs) { toast.error("End time must be after start time"); return; }

    setSaving(true);
    try {
      if (isEdit) {
        await updateGroup({
          id: editId!,
          name: name.trim(),
          discountType,
          discountValue: val,
          startTime: startMs,
          endTime: endMs,
          isActive,
        });
        toast.success("Discount group updated");
      } else {
        await createGroup({
          name: name.trim(),
          discountType,
          discountValue: val,
          startTime: startMs,
          endTime: endMs,
          isActive,
        });
        toast.success("Discount group created");
      }
      onOpenChange(false);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Discount Group" : "New Discount Group"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="dg-name">Group Name *</Label>
            <Input id="dg-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Eid Dhamaka Offer" autoFocus />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Discount Type</Label>
              <Select value={discountType} onValueChange={(v) => setDiscountType(v as "percentage" | "fixed")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">Percentage (%)</SelectItem>
                  <SelectItem value="fixed">Fixed Amount (৳)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="dg-value">
                {discountType === "percentage" ? "Discount (%)" : "Amount off (৳)"}
              </Label>
              <Input
                id="dg-value"
                type="number"
                min="0"
                max={discountType === "percentage" ? "100" : undefined}
                step="1"
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
                placeholder={discountType === "percentage" ? "20" : "100"}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="dg-start">Starts *</Label>
            <Input id="dg-start" type="datetime-local" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Switch id="dg-indefinite" checked={indefinite} onCheckedChange={setIndefinite} />
              <Label htmlFor="dg-indefinite" className="cursor-pointer font-normal">No end date</Label>
            </div>
            {!indefinite && (
              <div className="space-y-2">
                <Label htmlFor="dg-end">Ends</Label>
                <Input id="dg-end" type="datetime-local" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <Switch id="dg-active" checked={isActive} onCheckedChange={setIsActive} />
            <Label htmlFor="dg-active" className="cursor-pointer font-normal">Active</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {isEdit ? "Save Changes" : "Create Group"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
