"use client";

import { usePaginatedQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Eye } from "lucide-react";
import Link from "next/link";

export default function AdminCustomersPage() {
  const { results, status, loadMore } = usePaginatedQuery(
    api.users.listCustomers,
    {},
    { initialNumItems: 25 }
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Customers</h1>
        <p className="text-sm text-muted-foreground mt-1">View and manage customer accounts</p>
      </div>

      <div className="border rounded">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead className="w-16">View</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {status === "LoadingFirstPage" ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></TableCell></TableRow>
            ) : results.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No customers yet</TableCell></TableRow>
            ) : results.map((user) => (
              <TableRow key={user._id}>
                <TableCell>{user.name ?? "—"}</TableCell>
                <TableCell className="text-sm">{user.email ?? user.phone ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant={user.isActive === false ? "destructive" : "default"} className="text-xs">
                    {user.isActive === false ? "Deactivated" : "Active"}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {new Date(user._creationTime).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                    <Link href={`/admin/customers/${user._id}`}><Eye className="h-3 w-3" /></Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {status === "CanLoadMore" && (
        <div className="flex justify-center">
          <Button variant="outline" onClick={() => loadMore(25)}>Load More</Button>
        </div>
      )}
    </div>
  );
}
