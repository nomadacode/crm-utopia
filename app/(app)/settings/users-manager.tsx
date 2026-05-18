"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Mail, Plus, ShieldCheck, UserMinus, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type UserRow = {
  user_id: string;
  email: string;
  full_name: string | null;
  role: "admin" | "agent";
  is_active: boolean;
  created_at: string;
  last_sign_in_at: string | null;
};

export function UsersManager({
  initialUsers,
  currentUserId,
}: {
  initialUsers: UserRow[];
  currentUserId: string;
}) {
  const [users, setUsers] = useState<UserRow[]>(initialUsers);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [pending, setPending] = useState<Set<string>>(new Set());

  function markPending(key: string, on: boolean) {
    setPending((prev) => {
      const next = new Set(prev);
      if (on) next.add(key);
      else next.delete(key);
      return next;
    });
  }

  async function changeRole(user: UserRow, role: "admin" | "agent") {
    if (user.role === role) return;
    markPending(`${user.user_id}:role`, true);
    try {
      const res = await fetch(`/api/users/${user.user_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      const data = (await res.json().catch(() => null)) as
        | { ok: true }
        | { error: string }
        | null;
      if (!res.ok) {
        toast.error((data && "error" in data && data.error) || "Error al cambiar rol");
        return;
      }
      setUsers((prev) =>
        prev.map((u) => (u.user_id === user.user_id ? { ...u, role } : u)),
      );
      toast.success(`Rol actualizado a ${role}`);
    } finally {
      markPending(`${user.user_id}:role`, false);
    }
  }

  async function setActive(user: UserRow, active: boolean) {
    if (user.is_active === active) return;
    if (!active && !confirm(`¿Revocar acceso a ${user.email}?`)) return;
    markPending(`${user.user_id}:active`, true);
    try {
      const res = await fetch(`/api/users/${user.user_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: active }),
      });
      const data = (await res.json().catch(() => null)) as
        | { ok: true }
        | { error: string }
        | null;
      if (!res.ok) {
        toast.error((data && "error" in data && data.error) || "Error");
        return;
      }
      setUsers((prev) =>
        prev.map((u) =>
          u.user_id === user.user_id ? { ...u, is_active: active } : u,
        ),
      );
      toast.success(active ? "Acceso restaurado" : "Acceso revocado");
    } finally {
      markPending(`${user.user_id}:active`, false);
    }
  }

  function onInvited(newUser: {
    user_id: string;
    email: string;
    role: "admin" | "agent";
    full_name: string | null;
  }) {
    setUsers((prev) => {
      if (prev.some((u) => u.user_id === newUser.user_id)) return prev;
      return [
        ...prev,
        {
          ...newUser,
          is_active: true,
          created_at: new Date().toISOString(),
          last_sign_in_at: null,
        },
      ];
    });
    setInviteOpen(false);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">
          Usuarios ({users.length})
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setInviteOpen(true)}
        >
          <Plus className="h-3.5 w-3.5" />
          Invitar
        </Button>
      </div>

      {inviteOpen && (
        <InviteForm
          onCancel={() => setInviteOpen(false)}
          onInvited={onInvited}
        />
      )}

      <ul className="space-y-2">
        {users.map((user) => {
          const isSelf = user.user_id === currentUserId;
          const roleBusy = pending.has(`${user.user_id}:role`);
          const activeBusy = pending.has(`${user.user_id}:active`);
          return (
            <li
              key={user.user_id}
              className={cn(
                "rounded-md border bg-background px-4 py-3",
                user.is_active ? "border-border" : "border-border opacity-60",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      {user.full_name ?? user.email.split("@")[0]}
                    </span>
                    {isSelf && (
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        (vos)
                      </span>
                    )}
                    {!user.is_active && (
                      <span className="rounded-sm bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-destructive">
                        Inactivo
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground tabular">
                    {user.email}
                  </p>
                  <p className="mt-1 text-[10px] text-muted-foreground tabular">
                    {user.last_sign_in_at
                      ? `Último login: ${new Date(user.last_sign_in_at).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" })}`
                      : "Nunca se logueó"}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <select
                    value={user.role}
                    disabled={roleBusy || isSelf}
                    onChange={(e) =>
                      changeRole(user, e.target.value as "admin" | "agent")
                    }
                    className="rounded-md border border-input bg-background px-2 py-1 text-xs"
                  >
                    <option value="agent">Agente</option>
                    <option value="admin">Admin</option>
                  </select>
                  {user.is_active ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setActive(user, false)}
                      disabled={activeBusy || isSelf}
                      aria-label="Revocar acceso"
                      title={isSelf ? "No podés revocarte a vos mismo" : "Revocar acceso"}
                    >
                      {activeBusy ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <UserMinus className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setActive(user, true)}
                      disabled={activeBusy}
                    >
                      {activeBusy ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <UserPlus className="h-3.5 w-3.5" />
                      )}
                      Reactivar
                    </Button>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="rounded-md bg-muted/40 px-4 py-3 text-xs text-muted-foreground">
        <p className="flex items-center gap-1.5 font-medium text-foreground">
          <ShieldCheck className="h-3.5 w-3.5" />
          Roles
        </p>
        <ul className="mt-1.5 space-y-1">
          <li><strong className="text-foreground">Admin</strong> — gestiona ajustes, presets, tags, usuarios.</li>
          <li><strong className="text-foreground">Agente</strong> — ve y responde conversaciones, edita perfiles de contactos.</li>
        </ul>
      </div>
    </div>
  );
}

function InviteForm({
  onCancel,
  onInvited,
}: {
  onCancel: () => void;
  onInvited: (user: {
    user_id: string;
    email: string;
    role: "admin" | "agent";
    full_name: string | null;
  }) => void;
}) {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<"admin" | "agent">("agent");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!email.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/users/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          role,
          full_name: fullName.trim() || undefined,
        }),
      });
      const data = (await res.json().catch(() => null)) as
        | { ok: true; user: { user_id: string; email: string; role: "admin" | "agent"; full_name: string | null } }
        | { error: string }
        | null;
      if (!res.ok || !data || "error" in data) {
        toast.error(
          (data && "error" in data && data.error) || "No se pudo enviar la invitación",
        );
        return;
      }
      toast.success(`Invitación enviada a ${data.user.email}`);
      onInvited(data.user);
      setEmail("");
      setFullName("");
      setRole("agent");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-3 rounded-md border border-border bg-muted/30 p-4">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">
        Invitar usuario
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="invite-email" className="text-xs">
          Email
        </Label>
        <Input
          id="invite-email"
          type="email"
          value={email}
          placeholder="nombre@empresa.com"
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="invite-name" className="text-xs">
          Nombre (opcional)
        </Label>
        <Input
          id="invite-name"
          value={fullName}
          placeholder="Ej: Ana López"
          onChange={(e) => setFullName(e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="invite-role" className="text-xs">
          Rol
        </Label>
        <select
          id="invite-role"
          value={role}
          onChange={(e) => setRole(e.target.value as "admin" | "agent")}
          className="block w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
        >
          <option value="agent">Agente</option>
          <option value="admin">Admin</option>
        </select>
      </div>
      <div className="flex items-center gap-2 pt-1">
        <Button size="sm" onClick={submit} disabled={submitting || !email.trim()}>
          {submitting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Mail className="h-3.5 w-3.5" />
          )}
          Enviar invitación
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel} disabled={submitting}>
          Cancelar
        </Button>
      </div>
      <p className="text-[10px] text-muted-foreground">
        Se le envía un email con un link mágico. Al hacer click queda logueado
        automáticamente, no necesita contraseña.
      </p>
    </div>
  );
}
