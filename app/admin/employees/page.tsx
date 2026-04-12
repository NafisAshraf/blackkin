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
  orders: boolean;
  marketing: boolean;
  products: boolean;
  settings: boolean;
  pages: boolean;
  users: boolean;
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

const PERMISSION_LABELS: Record<keyof Permissions, string> = {
  orders: "Orders",
  marketing: "Marketing",
  products: "Products",
  settings: "Settings",
  pages: "Pages",
  users: "Users",
};

const PERMISSION_KEYS = Object.keys(PERMISSION_LABELS) as (keyof Permissions)[];

const DEFAULT_PERMISSIONS: Permissions = {
  orders: false,
  marketing: false,
  products: false,
  settings: false,
  pages: false,
  users: false,
};

// ─── Permission Checkboxes ────────────────────────────────────────────────────

function PermissionCheckboxes({
  permissions,
  onChange,
}: {
  permissions: Permissions;
  onChange: (p: Permissions) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {PERMISSION_KEYS.map((key) => (
        <div key={key} className="flex items-center gap-2">
          <Checkbox
            id={`perm-${key}`}
            checked={permissions[key]}
            onCheckedChange={(checked) =>
              onChange({ ...permissions, [key]: checked === true })
            }
          />
          <Label htmlFor={`perm-${key}`} className="font-normal cursor-pointer">
            {PERMISSION_LABELS[key]}
          </Label>
        </div>
      ))}
    </div>
  );
}

// ─── Add Employee Dialog ──────────────────────────────────────────────────────

function AddEmployeeDialog({ onClose }: { onClose: () => void }) {
  const createEmployee = useAction(api.employeeActions.createEmployee);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [permissions, setPermissions] = useState<Permissions>({ ...DEFAULT_PERMISSIONS });
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await createEmployee({ name, email, password, permissions });
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
    <DialogContent className="max-w-md">
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
          <PermissionCheckboxes permissions={permissions} onChange={setPermissions} />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
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
    employee.permissions ?? { ...DEFAULT_PERMISSIONS }
  );
  const [loading, setLoading] = useState(false);

  async function handleSave() {
    setLoading(true);
    try {
      await updatePermissions({ userId: employee._id, permissions });
      toast.success("Permissions updated");
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to update permissions");
    } finally {
      setLoading(false);
    }
  }

  return (
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle>Edit Permissions — {employee.name ?? employee.email ?? "Employee"}</DialogTitle>
      </DialogHeader>
      <div className="space-y-4 py-2">
        <PermissionCheckboxes permissions={permissions} onChange={setPermissions} />
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

  const [dialogState, setDialogState] = useState<DialogState>({ mode: "closed" });
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
        <Button onClick={() => setDialogState({ mode: "add" })}>Add Employee</Button>
      </div>

      {/* Dialog */}
      <Dialog open={isOpen} onOpenChange={(open) => !open && setDialogState({ mode: "closed" })}>
        {dialogState.mode === "add" && (
          <AddEmployeeDialog onClose={() => setDialogState({ mode: "closed" })} />
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
        <p className="text-muted-foreground text-sm py-4">No employees found.</p>
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
                      <span className="text-muted-foreground text-sm">No name</span>
                    )}
                  </TableCell>

                  {/* Contact */}
                  <TableCell>
                    <div className="space-y-0.5">
                      {emp.email && (
                        <p className="text-sm">{emp.email}</p>
                      )}
                      {emp.phone && (
                        <p className="text-xs text-muted-foreground">{emp.phone}</p>
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
                      <span className="text-xs text-muted-foreground italic">All access</span>
                    ) : emp.permissions ? (
                      <div className="flex flex-wrap gap-1">
                        {PERMISSION_KEYS.filter((k) => emp.permissions![k]).map((k) => (
                          <span
                            key={k}
                            className="inline-flex items-center rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground"
                          >
                            {PERMISSION_LABELS[k]}
                          </span>
                        ))}
                        {PERMISSION_KEYS.filter((k) => emp.permissions![k]).length === 0 && (
                          <span className="text-xs text-muted-foreground">None</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">None</span>
                    )}
                  </TableCell>

                  {/* Actions */}
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      {emp.role !== "superadmin" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setDialogState({ mode: "edit", employee: emp })}
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
