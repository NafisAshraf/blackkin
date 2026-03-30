"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { RowActionsMenu } from "@/components/admin/RowActionsMenu";

type ScopeType = "storewide" | "category" | "tag" | "product";

function toIso(ms: number) {
  return new Date(ms).toISOString().slice(0, 16);
}
function formatDate(ms: number) {
  return new Date(ms).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

const DEFAULT_FORM = {
  name: "Sale",
  discountType: "percentage" as "percentage" | "fixed",
  discountValue: "",
  startTime: toIso(Date.now()),
  endTime: toIso(Date.now() + 7 * 24 * 60 * 60 * 1000),
  scopeType: "storewide" as ScopeType,
  scopeCategoryId: "",
  scopeTagId: "",
  scopeProductId: "",
  isActive: true,
};

export default function CampaignsPage() {
  const campaigns = useQuery(api.salesCampaigns.listAll);
  const categories = useQuery(api.categories.list);
  const tags = useQuery(api.tags.list);

  const createCampaign = useMutation(api.salesCampaigns.create);
  const updateCampaign = useMutation(api.salesCampaigns.update);
  const removeCampaign = useMutation(api.salesCampaigns.remove);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<Id<"salesCampaigns"> | null>(null);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: Id<"salesCampaigns">; name: string } | null>(null);

  function openCreate() {
    setEditId(null);
    setForm({ ...DEFAULT_FORM, startTime: toIso(Date.now()), endTime: toIso(Date.now() + 7 * 24 * 60 * 60 * 1000) });
    setDialogOpen(true);
  }

  function openEdit(c: any) {
    setEditId(c._id);
    setForm({
      name: c.name,
      discountType: c.discountType,
      discountValue: c.discountValue.toString(),
      startTime: toIso(c.startTime),
      endTime: toIso(c.endTime),
      scopeType: c.scope.type,
      scopeCategoryId: c.scope.type === "category" ? c.scope.categoryId : "",
      scopeTagId: c.scope.type === "tag" ? c.scope.tagId : "",
      scopeProductId: c.scope.type === "product" ? c.scope.productId : "",
      isActive: c.isActive,
    });
    setDialogOpen(true);
  }

  function buildScope() {
    if (form.scopeType === "storewide") return { type: "storewide" as const };
    if (form.scopeType === "category") return { type: "category" as const, categoryId: form.scopeCategoryId as Id<"categories"> };
    if (form.scopeType === "tag") return { type: "tag" as const, tagId: form.scopeTagId as Id<"tags"> };
    return { type: "product" as const, productId: form.scopeProductId as Id<"products"> };
  }

  async function handleSave() {
    if (!form.discountValue || parseFloat(form.discountValue) <= 0) { toast.error("Discount value must be positive"); return; }
    if (form.scopeType === "category" && !form.scopeCategoryId) { toast.error("Select a category"); return; }
    if (form.scopeType === "tag" && !form.scopeTagId) { toast.error("Select a tag"); return; }

    setSaving(true);
    try {
      const payload = {
        name: form.name || "Sale",
        discountType: form.discountType,
        discountValue: parseFloat(form.discountValue),
        startTime: new Date(form.startTime).getTime(),
        endTime: new Date(form.endTime).getTime(),
        scope: buildScope(),
        isActive: form.isActive,
      };
      if (editId) { await updateCampaign({ id: editId, ...payload }); toast.success("Campaign updated"); }
      else { await createCampaign(payload); toast.success("Campaign created"); }
      setDialogOpen(false);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  function scopeLabel(c: any) {
    const s = c.scope;
    if (s.type === "storewide") return "Storewide";
    if (s.type === "category") { const cat = categories?.find((x) => x._id === s.categoryId); return `Category: ${cat?.name ?? "…"}`; }
    if (s.type === "tag") { const tag = tags?.find((x) => x._id === s.tagId); return `Tag: ${tag?.name ?? "…"}`; }
    return "Product";
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Campaigns</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage discount campaigns</p>
        </div>
        <Button size="sm" onClick={openCreate}><Plus className="h-4 w-4 mr-1" /> New Campaign</Button>
      </div>

      {/* Delete confirmation */}
      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &quot;{deleteTarget?.name}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently remove this campaign.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteTarget) {
                  removeCampaign({ id: deleteTarget.id })
                    .then(() => toast.success("Deleted"))
                    .catch((e) => toast.error(e.message));
                  setDeleteTarget(null);
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="border rounded">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Discount</TableHead>
              <TableHead>Scope</TableHead>
              <TableHead>Start</TableHead>
              <TableHead>End</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-12">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {campaigns === undefined ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></TableCell></TableRow>
            ) : campaigns.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No campaigns yet</TableCell></TableRow>
            ) : campaigns.map((c) => (
              <TableRow key={c._id}>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell>{c.discountType === "percentage" ? `${c.discountValue}% off` : `৳${c.discountValue} off`}</TableCell>
                <TableCell className="text-sm">{scopeLabel(c)}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{formatDate(c.startTime)}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{formatDate(c.endTime)}</TableCell>
                <TableCell>
                  <Badge variant={c.isActive && c.endTime > Date.now() ? "default" : "secondary"}>
                    {c.isActive && c.endTime > Date.now() ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <RowActionsMenu
                    actions={[
                      { label: "Edit", icon: Pencil, onClick: () => openEdit(c) },
                      {
                        label: "Delete",
                        icon: Trash2,
                        variant: "destructive",
                        separator: true,
                        onClick: () => setDeleteTarget({ id: c._id, name: c.name }),
                      },
                    ]}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editId ? "Edit Campaign" : "New Campaign"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="e.g. Winter Flash Sale" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Discount Type</Label>
                <Select value={form.discountType} onValueChange={(v: any) => setForm((p) => ({ ...p, discountType: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage (%)</SelectItem>
                    <SelectItem value="fixed">Fixed (৳)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Value {form.discountType === "percentage" ? "(%)" : "(৳)"}</Label>
                <Input type="number" min="0.01" value={form.discountValue} onChange={(e) => setForm((p) => ({ ...p, discountValue: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Time</Label>
                <Input type="datetime-local" value={form.startTime} onChange={(e) => setForm((p) => ({ ...p, startTime: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>End Time</Label>
                <Input type="datetime-local" value={form.endTime} onChange={(e) => setForm((p) => ({ ...p, endTime: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Scope</Label>
              <Select value={form.scopeType} onValueChange={(v: any) => setForm((p) => ({ ...p, scopeType: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="storewide">Storewide</SelectItem>
                  <SelectItem value="category">By Category</SelectItem>
                  <SelectItem value="tag">By Tag</SelectItem>
                  <SelectItem value="product">Specific Product</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.scopeType === "category" && (
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={form.scopeCategoryId} onValueChange={(v) => setForm((p) => ({ ...p, scopeCategoryId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent>{(categories ?? []).map((c) => <SelectItem key={c._id} value={c._id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            {form.scopeType === "tag" && (
              <div className="space-y-2">
                <Label>Tag</Label>
                <Select value={form.scopeTagId} onValueChange={(v) => setForm((p) => ({ ...p, scopeTagId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select tag" /></SelectTrigger>
                  <SelectContent>{(tags ?? []).map((t) => <SelectItem key={t._id} value={t._id}>{t.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            {form.scopeType === "product" && (
              <div className="space-y-2">
                <Label>Product ID</Label>
                <Input value={form.scopeProductId} onChange={(e) => setForm((p) => ({ ...p, scopeProductId: e.target.value }))} placeholder="Paste product ID" />
              </div>
            )}
            <div className="flex items-center gap-2">
              <input type="checkbox" id="isActive" checked={form.isActive} onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))} />
              <Label htmlFor="isActive">Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving…</> : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
