"use client";

import { useState } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, Pencil, UserX, UserCheck } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Permissions = {
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
  vouchers: boolean;
};

type Employee = {
  _id: Id<"users">;
  _creationTime: number;
  name?: string;
  email?: string;
  phone?: string;
  role: "admin" | "superadmin";
  isActive?: boolean;
  permissions?: Permissions;
};

const PERMISSION_LABELS: Omit<Record<keyof Permissions, string>, "orders"> & {
  orders: string;
} = {
  orders: "Orders",
  marketing: "Marketing",
  products: "Products",
  settings: "Settings",
  pages: "Pages",
  users: "Users",
  vouchers: "Vouchers",
};

const NON_ORDER_PERMISSION_KEYS = [
  "marketing",
  "products",
  "settings",
  "pages",
  "users",
  "vouchers",
] as const;
type NonOrderPermissionKey = (typeof NON_ORDER_PERMISSION_KEYS)[number];

const DEFAULT_PERMISSIONS: Permissions = {
  orders: undefined,
  marketing: false,
  products: false,
  settings: false,
  pages: false,
  users: false,
  vouchers: false,
};

const DROPDOWN_STATUS_OPTIONS = [
  { value: "new", label: "New" },
  { value: "confirmed", label: "Confirmed" },
  { value: "ready_for_delivery", label: "Ready for Delivery" },
  { value: "in_courier", label: "In-Courier" },
  { value: "cancelled", label: "Cancelled" },
  { value: "hold", label: "Hold" },
  { value: "ship_later", label: "Ship Later" },
  { value: "paid", label: "Paid" },
];

// ─── Orders Permission Section ────────────────────────────────────────────────

function OrdersPermissionSection({
  permissions,
  setPermissions,
}: {
  permissions: Permissions;
  setPermissions: React.Dispatch<React.SetStateAction<Permissions>>;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Checkbox
          id="orders-enabled"
          checked={permissions.orders?.enabled ?? false}
          onCheckedChange={(checked) =>
            setPermissions((p) => ({
              ...p,
              orders: checked
                ? {
                    enabled: true,
                    allowedStatuses: [],
                    canEdit: false,
                    canDelete: false,
                    canConfirm: false,
                  }
                : undefined,
            }))
          }
        />
        <Label htmlFor="orders-enabled">Orders Access</Label>
      </div>

      {permissions.orders?.enabled && (
        <div className="ml-6 space-y-3 border-l-2 border-muted pl-3">
          {/* Status Actions */}
          <div>
            <p className="text-sm font-medium mb-2">Allowed Status Actions</p>
            <div className="grid grid-cols-2 gap-y-1">
              {DROPDOWN_STATUS_OPTIONS.map((s) => (
                <div key={s.value} className="flex items-center gap-1.5">
                  <Checkbox
                    id={`status-${s.value}`}
                    checked={
                      permissions.orders?.allowedStatuses.includes(s.value) ??
                      false
                    }
                    onCheckedChange={(checked) =>
                      setPermissions((p) => ({
                        ...p,
                        orders: {
                          ...p.orders!,
                          allowedStatuses: checked
                            ? [...(p.orders?.allowedStatuses ?? []), s.value]
                            : (p.orders?.allowedStatuses ?? []).filter(
                                (v) => v !== s.value,
                              ),
                        },
                      }))
                    }
                  />
                  <Label
                    htmlFor={`status-${s.value}`}
                    className="text-xs font-normal"
                  >
                    {s.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {/* Action Permissions */}
          <div>
            <p className="text-sm font-medium mb-2">Action Permissions</p>
            <div className="space-y-1">
              {[
                { key: "canEdit" as const, label: "Edit orders" },
                { key: "canDelete" as const, label: "Delete orders" },
                {
                  key: "canConfirm" as const,
                  label: "Confirm (complete) orders",
                },
              ].map(({ key, label }) => (
                <div key={key} className="flex items-center gap-1.5">
                  <Checkbox
                    id={`action-${key}`}
                    checked={permissions.orders?.[key] ?? false}
                    onCheckedChange={(checked) =>
                      setPermissions((p) => ({
                        ...p,
                        orders: { ...p.orders!, [key]: !!checked },
                      }))
                    }
                  />
                  <Label
                    htmlFor={`action-${key}`}
                    className="text-xs font-normal"
                  >
                    {label}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Permission Checkboxes ────────────────────────────────────────────────────

function PermissionCheckboxes({
  permissions,
  setPermissions,
}: {
  permissions: Permissions;
  setPermissions: React.Dispatch<React.SetStateAction<Permissions>>;
}) {
  return (
    <div className="space-y-3">
      <OrdersPermissionSection
        permissions={permissions}
        setPermissions={setPermissions}
      />
      <div className="grid grid-cols-2 gap-2">
        {NON_ORDER_PERMISSION_KEYS.map((key) => (
          <div key={key} className="flex items-center gap-2">
            <Checkbox
              id={`perm-${key}`}
              checked={permissions[key] as boolean}
              onCheckedChange={(checked) =>
                setPermissions((p) => ({ ...p, [key]: checked === true }))
              }
            />
            <Label
              htmlFor={`perm-${key}`}
              className="font-normal cursor-pointer"
            >
              {PERMISSION_LABELS[key as NonOrderPermissionKey]}
            </Label>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Add Employee Dialog ──────────────────────────────────────────────────────

function AddEmployeeDialog({ onClose }: { onClose: () => void }) {
  const createEmployee = useAction(api.employeeActions.createEmployee);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [permissions, setPermissions] = useState<Permissions>({
    ...DEFAULT_PERMISSIONS,
  });
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await createEmployee({
        name,
        email,
        password,
        permissions,
      });
      if (result.success) {
        toast.success("Employee created successfully");
        onClose();
      } else {
        toast.error(result.error ?? "Failed to create employee");
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Add Employee</DialogTitle>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1">
          <Label htmlFor="emp-name">Full Name</Label>
          <Input
            id="emp-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="Jane Smith"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="emp-email">Email</Label>
          <Input
            id="emp-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="jane@example.com"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="emp-password">Password</Label>
          <Input
            id="emp-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="••••••••"
          />
        </div>
        <div className="space-y-2">
          <Label>Permissions</Label>
          <PermissionCheckboxes
            permissions={permissions}
            setPermissions={setPermissions}
          />
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Creating…
              </>
            ) : (
              "Create Employee"
            )}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

// ─── Edit Permissions Dialog ──────────────────────────────────────────────────

function EditPermissionsDialog({
  employee,
  onClose,
}: {
  employee: Employee;
  onClose: () => void;
}) {
  const updatePermissions = useMutation(api.employees.updatePermissions);

  const [permissions, setPermissions] = useState<Permissions>(
    employee.permissions ?? { ...DEFAULT_PERMISSIONS },
  );
  const [loading, setLoading] = useState(false);

  async function handleSave() {
    setLoading(true);
    try {
      await updatePermissions({ userId: employee._id, permissions });
      toast.success("Permissions updated");
      onClose();
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Failed to update permissions",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>
          Edit Permissions — {employee.name ?? employee.email ?? "Employee"}
        </DialogTitle>
      </DialogHeader>
      <div className="space-y-4 py-2">
        <PermissionCheckboxes
          permissions={permissions}
          setPermissions={setPermissions}
        />
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Saving…
            </>
          ) : (
            "Save"
          )}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type DialogState =
  | { mode: "closed" }
  | { mode: "add" }
  | { mode: "edit"; employee: Employee };

export default function EmployeesPage() {
  const employees = useQuery(api.employees.listEmployees);
  const deactivate = useMutation(api.employees.deactivateEmployee);
  const reactivate = useMutation(api.employees.reactivateEmployee);

  const [dialogState, setDialogState] = useState<DialogState>({
    mode: "closed",
  });
  const [actioningId, setActioningId] = useState<Id<"users"> | null>(null);

  async function handleToggleActive(employee: Employee) {
    setActioningId(employee._id);
    try {
      if (employee.isActive === false) {
        await reactivate({ userId: employee._id });
        toast.success(`${employee.name ?? "Employee"} reactivated`);
      } else {
        await deactivate({ userId: employee._id });
        toast.success(`${employee.name ?? "Employee"} deactivated`);
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setActioningId(null);
    }
  }

  const isOpen = dialogState.mode !== "closed";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Employees</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage admin accounts and their permissions.
          </p>
        </div>
        <Button onClick={() => setDialogState({ mode: "add" })}>
          Add Employee
        </Button>
      </div>

      {/* Dialog */}
      <Dialog
        open={isOpen}
        onOpenChange={(open) => !open && setDialogState({ mode: "closed" })}
      >
        {dialogState.mode === "add" && (
          <AddEmployeeDialog
            onClose={() => setDialogState({ mode: "closed" })}
          />
        )}
        {dialogState.mode === "edit" && (
          <EditPermissionsDialog
            employee={dialogState.employee}
            onClose={() => setDialogState({ mode: "closed" })}
          />
        )}
      </Dialog>

      {/* Table */}
      {employees === undefined ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : employees.length === 0 ? (
        <p className="text-muted-foreground text-sm py-4">
          No employees found.
        </p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Permissions</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees.map((emp) => (
                <TableRow key={emp._id}>
                  {/* Name */}
                  <TableCell>
                    {emp.name ? (
                      <span className="font-medium">{emp.name}</span>
                    ) : (
                      <span className="text-muted-foreground text-sm">
                        No name
                      </span>
                    )}
                  </TableCell>

                  {/* Contact */}
                  <TableCell>
                    <div className="space-y-0.5">
                      {emp.email && <p className="text-sm">{emp.email}</p>}
                      {emp.phone && (
                        <p className="text-xs text-muted-foreground">
                          {emp.phone}
                        </p>
                      )}
                      {!emp.email && !emp.phone && (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </div>
                  </TableCell>

                  {/* Role badge */}
                  <TableCell>
                    {emp.role === "superadmin" ? (
                      <Badge className="bg-purple-100 text-purple-800 border-purple-200 hover:bg-purple-100">
                        Superadmin
                      </Badge>
                    ) : (
                      <Badge className="bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-100">
                        Admin
                      </Badge>
                    )}
                  </TableCell>

                  {/* Status badge */}
                  <TableCell>
                    {emp.isActive === false ? (
                      <Badge variant="destructive">Inactive</Badge>
                    ) : (
                      <Badge className="bg-green-100 text-green-800 border-green-200 hover:bg-green-100">
                        Active
                      </Badge>
                    )}
                  </TableCell>

                  {/* Permissions pills */}
                  <TableCell>
                    {emp.role === "superadmin" ? (
                      <span className="text-xs text-muted-foreground italic">
                        All access
                      </span>
                    ) : emp.permissions ? (
                      <div className="flex flex-wrap gap-1">
                        {/* Orders pill — only shown when enabled */}
                        {emp.permissions.orders?.enabled && (
                          <span className="inline-flex items-center rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">
                            Orders
                          </span>
                        )}
                        {/* Other permission pills */}
                        {NON_ORDER_PERMISSION_KEYS.filter(
                          (k) => emp.permissions![k],
                        ).map((k) => (
                          <span
                            key={k}
                            className="inline-flex items-center rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground"
                          >
                            {PERMISSION_LABELS[k]}
                          </span>
                        ))}
                        {/* Show "None" if nothing is enabled */}
                        {!emp.permissions.orders?.enabled &&
                          NON_ORDER_PERMISSION_KEYS.every(
                            (k) => !emp.permissions![k],
                          ) && (
                            <span className="text-xs text-muted-foreground">
                              None
                            </span>
                          )}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        None
                      </span>
                    )}
                  </TableCell>

                  {/* Actions */}
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      {emp.role !== "superadmin" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setDialogState({ mode: "edit", employee: emp })
                          }
                        >
                          <Pencil className="h-3.5 w-3.5 mr-1" />
                          Edit
                        </Button>
                      )}
                      {emp.role !== "superadmin" && (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={actioningId === emp._id}
                          onClick={() => handleToggleActive(emp)}
                        >
                          {actioningId === emp._id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : emp.isActive === false ? (
                            <>
                              <UserCheck className="h-3.5 w-3.5 mr-1" />
                              Reactivate
                            </>
                          ) : (
                            <>
                              <UserX className="h-3.5 w-3.5 mr-1" />
                              Deactivate
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
