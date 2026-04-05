"use client";

import { useParams } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Loader2, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

export default function CustomerDetailPage() {
  const params = useParams();
  const userId = params.userId as Id<"users">;

  const data = useQuery(api.users.getCustomerDetail, { userId });
  const toggleActive = useMutation(api.users.toggleActive);
  const [toggling, setToggling] = useState(false);

  async function handleToggleActive() {
    if (!data?.user) return;
    setToggling(true);
    try {
      await toggleActive({ userId, isActive: data.user.isActive === false });
      toast.success(data.user.isActive === false ? "Account activated" : "Account deactivated");
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    } finally {
      setToggling(false);
    }
  }

  if (data === undefined) {
    return <div className="flex items-center justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }
  if (!data) {
    return <div className="py-12 text-center text-muted-foreground">Customer not found</div>;
  }

  const { user, recentOrders, wishlistCount } = data;

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/admin/customers"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-xl font-semibold">{user.name ?? user.email ?? user.phone ?? "—"}</h1>
          <p className="text-sm text-muted-foreground">{user.email ?? user.phone ?? "—"}</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Badge variant={user.isActive === false ? "destructive" : "default"}>
          {user.isActive === false ? "Deactivated" : "Active"}
        </Badge>
        <Badge variant="secondary">Customer</Badge>
        <Button variant="outline" size="sm" onClick={handleToggleActive} disabled={toggling}>
          {toggling ? <Loader2 className="h-4 w-4 animate-spin" /> : user.isActive === false ? "Activate Account" : "Deactivate Account"}
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-2xl font-bold">{recentOrders.length}</p>
            <p className="text-xs text-muted-foreground">Recent Orders</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-2xl font-bold">৳{recentOrders.reduce((s, o) => s + o.total, 0).toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Total Spent</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-2xl font-bold">{wishlistCount}</p>
            <p className="text-xs text-muted-foreground">Wishlist Items</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Recent Orders</CardTitle></CardHeader>
        <CardContent className="divide-y">
          {recentOrders.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">No orders yet</p>
          ) : recentOrders.map((order) => (
            <div key={order._id} className="py-3 flex items-center justify-between text-sm">
              <div>
                <p className="font-mono text-xs text-muted-foreground">{order._id.slice(-8)}</p>
                <p className="text-muted-foreground">{new Date(order._creationTime).toLocaleDateString()}</p>
              </div>
              <div className="text-right">
                <p className="font-medium">৳{order.total.toLocaleString()}</p>
                <Badge variant="outline" className="text-xs capitalize">{order.status}</Badge>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link href={`/admin/orders/${order._id}`}>View</Link>
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
