import { fetchAuthQuery } from "@/lib/auth-server";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Dashboard" };

export default async function AdminDashboardPage() {
  const stats = await fetchAuthQuery(api.dashboard.getStats);

  const statCards = [
    { label: "Total Customers", value: stats.totalCustomers },
    { label: "Total Products", value: stats.totalProducts },
    { label: "Total Categories", value: stats.totalCategories },
    { label: "Total Orders", value: stats.orders.total },
  ];

  const orderBreakdown = [
    { label: "New", value: stats.orders.new },
    { label: "Confirmed", value: stats.orders.confirmed },
    { label: "Ready for Delivery", value: stats.orders.ready_for_delivery },
    { label: "In Courier", value: stats.orders.in_courier },
    { label: "Completed", value: stats.orders.completed },
    { label: "Cancelled", value: stats.orders.cancelled },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">Overview of your store</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <Card key={card.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {card.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{card.value.toLocaleString()}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-4">Order Breakdown</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {orderBreakdown.map((item) => (
            <Card key={item.label}>
              <CardHeader className="pb-1 pt-4 px-4">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {item.label}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <p className="text-2xl font-bold">{item.value.toLocaleString()}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
