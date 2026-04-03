"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Home, Briefcase, Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

type AddressType = "home" | "work";

interface AddressFormState {
  type: AddressType;
  name: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  postalCode: string;
}

const emptyForm = (type: AddressType = "home"): AddressFormState => ({
  type,
  name: "",
  phone: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  postalCode: "",
});

export default function AccountPage() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const currentUser = useQuery(
    api.users.getCurrentUserWithRole,
    session ? {} : "skip"
  );
  const savedAddresses = useQuery(
    api.addresses.getSavedAddresses,
    session ? {} : "skip"
  );
  const saveAddressMutation = useMutation(api.addresses.saveAddress);
  const deleteAddressMutation = useMutation(api.addresses.deleteAddress);

  const [editingType, setEditingType] = useState<AddressType | null>(null);
  const [form, setForm] = useState<AddressFormState>(emptyForm());
  const [isSaving, setIsSaving] = useState(false);

  const handleSignOut = async () => {
    await authClient.signOut();
    router.push("/");
  };

  const homeAddress = savedAddresses?.find((a) => a.type === "home");
  const workAddress = savedAddresses?.find((a) => a.type === "work");

  function startEdit(type: AddressType) {
    const existing = savedAddresses?.find((a) => a.type === type);
    setForm({
      type,
      name: existing?.name ?? "",
      phone: existing?.phone ?? "",
      addressLine1: existing?.addressLine1 ?? "",
      addressLine2: existing?.addressLine2 ?? "",
      city: existing?.city ?? "",
      postalCode: existing?.postalCode ?? "",
    });
    setEditingType(type);
  }

  function startAdd() {
    // Pick whichever type doesn't exist yet
    const missingType = !homeAddress ? "home" : "work";
    setForm(emptyForm(missingType));
    setEditingType(missingType);
  }

  function cancelEdit() {
    setEditingType(null);
    setForm(emptyForm());
  }

  async function handleSave() {
    if (!form.name.trim() || !form.phone.trim() || !form.addressLine1.trim() || !form.city.trim()) {
      toast.error("Please fill in all required fields");
      return;
    }
    setIsSaving(true);
    try {
      await saveAddressMutation({
        type: form.type,
        name: form.name.trim(),
        phone: form.phone.trim(),
        addressLine1: form.addressLine1.trim(),
        ...(form.addressLine2.trim() ? { addressLine2: form.addressLine2.trim() } : {}),
        city: form.city.trim(),
        ...(form.postalCode.trim() ? { postalCode: form.postalCode.trim() } : {}),
      });
      toast.success(`${form.type === "home" ? "Home" : "Work"} address saved`);
      setEditingType(null);
      setForm(emptyForm());
    } catch {
      toast.error("Failed to save address");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(addressId: Id<"userAddresses">, type: AddressType) {
    if (!confirm(`Delete your ${type} address?`)) return;
    try {
      await deleteAddressMutation({ addressId });
      toast.success("Address deleted");
    } catch {
      toast.error("Failed to delete address");
    }
  }

  const canAddMore = savedAddresses !== undefined && savedAddresses.length < 2;

  if (isPending) return null;
  if (!session) return null;

  return (
    <>
      <Navbar />
      <main className="max-w-5xl mx-auto px-6 py-12">
        <h1 className="text-2xl font-semibold mb-8">Your Account</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Profile</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Email</span>
                <span>{session.user.email}</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Name</span>
                <span>{session.user.name || "Not provided"}</span>
              </div>
              <Separator />
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Role</span>
                <Badge variant="secondary">
                  {currentUser?.role ?? "customer"}
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Security</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-4">
              <p className="text-muted-foreground">
                You authenticated using email and password.
              </p>
              <Button variant="outline" size="sm" onClick={handleSignOut}>
                Sign Out
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Addresses Card */}
        <Card className="mb-6">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">Saved Addresses</CardTitle>
            {canAddMore && editingType === null && (
              <Button variant="outline" size="sm" onClick={startAdd} className="gap-1.5 text-xs">
                <Plus className="h-3.5 w-3.5" />
                Add Address
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {savedAddresses === undefined ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                {/* Saved address blocks */}
                {[homeAddress, workAddress].map((addr) => {
                  if (!addr) return null;
                  const Icon = addr.type === "home" ? Home : Briefcase;
                  const label = addr.type === "home" ? "Home" : "Work";
                  return (
                    <div key={addr._id} className="flex items-start gap-3 p-3 border border-border rounded-md">
                      <Icon className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0 text-sm">
                        <p className="font-medium text-xs text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
                        <p>{addr.name} · {addr.phone}</p>
                        <p className="text-muted-foreground">
                          {addr.addressLine1}
                          {addr.addressLine2 ? `, ${addr.addressLine2}` : ""}
                        </p>
                        <p className="text-muted-foreground">
                          {addr.city}{addr.postalCode ? ` ${addr.postalCode}` : ""}
                        </p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => startEdit(addr.type)}
                          title="Edit"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => handleDelete(addr._id, addr.type)}
                          title="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}

                {/* Empty state */}
                {savedAddresses.length === 0 && editingType === null && (
                  <p className="text-sm text-muted-foreground">
                    No saved addresses yet. Add a home or work address to speed up checkout.
                  </p>
                )}

                {/* Inline add/edit form */}
                {editingType !== null && (
                  <div className="border border-border rounded-md p-4 space-y-4">
                    {/* Type selector — only show options for types not already saved (unless editing that type) */}
                    <div className="space-y-1.5">
                      <Label className="text-xs">Address Type</Label>
                      <div className="flex gap-2">
                        {(["home", "work"] as AddressType[]).map((t) => {
                          const existingOfType = savedAddresses.find((a) => a.type === t);
                          const isDisabled = existingOfType !== undefined && t !== editingType;
                          return (
                            <button
                              key={t}
                              type="button"
                              disabled={isDisabled}
                              onClick={() => setForm((f) => ({ ...f, type: t }))}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                                form.type === t
                                  ? "bg-foreground text-background border-foreground"
                                  : isDisabled
                                  ? "opacity-40 cursor-not-allowed border-border text-muted-foreground"
                                  : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
                              }`}
                            >
                              {t === "home" ? <Home className="h-3 w-3" /> : <Briefcase className="h-3 w-3" />}
                              {t === "home" ? "Home" : "Work"}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label htmlFor="addr-name" className="text-xs">Full Name *</Label>
                        <Input
                          id="addr-name"
                          value={form.name}
                          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                          placeholder="John Doe"
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="addr-phone" className="text-xs">Phone *</Label>
                        <Input
                          id="addr-phone"
                          value={form.phone}
                          onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                          placeholder="+880 1XXX XXXXXX"
                          className="h-8 text-sm"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="addr-line1" className="text-xs">Address Line 1 *</Label>
                      <Input
                        id="addr-line1"
                        value={form.addressLine1}
                        onChange={(e) => setForm((f) => ({ ...f, addressLine1: e.target.value }))}
                        placeholder="House/Flat, Road, Area"
                        className="h-8 text-sm"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="addr-line2" className="text-xs">Address Line 2</Label>
                      <Input
                        id="addr-line2"
                        value={form.addressLine2}
                        onChange={(e) => setForm((f) => ({ ...f, addressLine2: e.target.value }))}
                        placeholder="Optional"
                        className="h-8 text-sm"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label htmlFor="addr-city" className="text-xs">City *</Label>
                        <Input
                          id="addr-city"
                          value={form.city}
                          onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                          placeholder="Dhaka"
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="addr-postal" className="text-xs">Postal Code</Label>
                        <Input
                          id="addr-postal"
                          value={form.postalCode}
                          onChange={(e) => setForm((f) => ({ ...f, postalCode: e.target.value }))}
                          placeholder="1207"
                          className="h-8 text-sm"
                        />
                      </div>
                    </div>

                    <div className="flex gap-2 pt-1">
                      <Button size="sm" onClick={handleSave} disabled={isSaving} className="gap-1.5">
                        {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                        Save Address
                      </Button>
                      <Button size="sm" variant="ghost" onClick={cancelEdit} disabled={isSaving}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quick Links</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Link href="/account/orders">
              <Button variant="ghost">My Orders</Button>
            </Link>
            <Link href="/account/wishlist">
              <Button variant="ghost">My Wishlist</Button>
            </Link>
            <Link href="/products">
              <Button variant="ghost">Shop</Button>
            </Link>
          </CardContent>
        </Card>
      </main>
    </>
  );
}
