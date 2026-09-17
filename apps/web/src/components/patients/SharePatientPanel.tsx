"use client";

import { useCallback, useEffect, useState } from "react";
import { Share2, UserMinus, Mail, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";

type MemberRole = "owner" | "collaborator" | "viewer";

type Member = {
  id: string;
  userId: string;
  role: MemberRole;
  email: string | null;
  createdAt: string;
};

type Invite = {
  id: string;
  email: string;
  role: MemberRole;
  status: string;
  createdAt: string;
};

export function SharePatientPanel({
  patientId,
  myRole,
}: {
  patientId: string;
  myRole?: MemberRole;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [role, setRole] = useState<MemberRole>(myRole ?? "viewer");
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"collaborator" | "viewer">("collaborator");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isOwner = role === "owner";

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/patients/${patientId}/members`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load members");
      setMembers(json.data.members ?? []);
      setInvites(json.data.invites ?? []);
      if (json.data.myRole) setRole(json.data.myRole);
      if (json.data.myUserId) setMyUserId(json.data.myUserId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/patients/${patientId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role: inviteRole }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Invite failed");
      setEmail("");
      setMessage(
        json.message ??
          (json.data?.type === "member"
            ? "Access granted — they can select this patient now."
            : "Invite pending until they sign up with that email.")
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invite failed");
    } finally {
      setBusy(false);
    }
  }

  async function removeMember(targetUserId: string, label?: string) {
    const leaving = myUserId && targetUserId === myUserId;
    if (
      !confirm(
        leaving
          ? "Leave this patient? You will lose access until invited again."
          : `Revoke access for ${label ?? "this person"}? They will lose access immediately.`
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/patients/${patientId}/members`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: targetUserId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Remove failed");
      setMessage(leaving ? "You left this patient." : "Access revoked.");
      await load();
      if (leaving) {
        window.location.href = "/";
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Remove failed");
    } finally {
      setBusy(false);
    }
  }

  async function revokeInvite(inviteId: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/patients/${patientId}/members`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Revoke failed");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Revoke failed");
    } finally {
      setBusy(false);
    }
  }

  async function changeRole(targetUserId: string, next: "collaborator" | "viewer") {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/patients/${patientId}/members`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: targetUserId, role: next }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Update failed");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  const roleBadge = (r: MemberRole) => {
    const variant = r === "owner" ? "default" : r === "collaborator" ? "success" : "neutral";
    return <Badge variant={variant}>{r}</Badge>;
  };

  return (
    <div className="space-y-3">
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() => setOpen((v) => !v)}
      >
        <Share2 className="w-4 h-4" />
        {open ? "Hide sharing" : "Share patient"}
      </Button>

      {open && (
        <Card>
          <CardHeader>
            <h3 className="font-semibold text-slate-800 text-sm">Shared access</h3>
            <p className="text-xs text-slate-500 mt-1">
              Invite a family member, carer, or clinician by email. They must use the same email
              when signing up. Shared health data — only invite people you trust. AI features may
              send patient data to third-party model providers when used.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading && (
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading…
              </div>
            )}

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                {error}
              </p>
            )}
            {message && (
              <p className="text-sm text-green-700 bg-green-50 border border-green-100 rounded-lg px-3 py-2">
                {message}
              </p>
            )}

            {!loading && (
              <ul className="space-y-2">
                {members.map((m) => (
                  <li
                    key={m.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">
                        {m.email ?? m.userId}
                      </p>
                      <div className="mt-1">{roleBadge(m.role)}</div>
                    </div>
                    {isOwner && m.role !== "owner" && (
                      <div className="flex items-center gap-2">
                        <select
                          value={m.role}
                          disabled={busy}
                          onChange={(e) =>
                            changeRole(m.userId, e.target.value as "collaborator" | "viewer")
                          }
                          className="text-xs border border-slate-200 rounded-md px-2 py-1"
                          aria-label="Change role"
                        >
                          <option value="collaborator">collaborator</option>
                          <option value="viewer">viewer</option>
                        </select>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          disabled={busy}
                          onClick={() => removeMember(m.userId, m.email ?? undefined)}
                        >
                          <UserMinus className="w-3.5 h-3.5" />
                          Revoke
                        </Button>
                      </div>
                    )}
                    {!isOwner && myUserId && m.userId === myUserId && m.role !== "owner" && (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={busy}
                        onClick={() => removeMember(m.userId)}
                      >
                        Leave
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {invites.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                  Pending invites
                </p>
                {invites.map((inv) => (
                  <div
                    key={inv.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50/50 px-3 py-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Mail className="w-4 h-4 text-amber-600 shrink-0" />
                      <span className="text-sm truncate">{inv.email}</span>
                      {roleBadge(inv.role)}
                    </div>
                    {isOwner && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => revokeInvite(inv.id)}
                        className="text-xs text-amber-800 underline"
                      >
                        Revoke invite
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {isOwner && (
              <form onSubmit={invite} className="space-y-2 border-t border-slate-100 pt-4">
                <label className="block text-xs font-medium text-slate-600">
                  Invite by email
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="flex-1 text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <select
                    value={inviteRole}
                    onChange={(e) =>
                      setInviteRole(e.target.value as "collaborator" | "viewer")
                    }
                    className="text-sm border border-slate-300 rounded-lg px-2 py-2"
                  >
                    <option value="collaborator">Collaborator (can edit)</option>
                    <option value="viewer">Viewer (read only)</option>
                  </select>
                  <Button type="submit" size="sm" disabled={busy || !email.trim()}>
                    Invite
                  </Button>
                </div>
              </form>
            )}

            {!isOwner && !loading && (
              <p className="text-xs text-slate-500">
                Your role: <strong>{role}</strong>. Only the owner can invite others.
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
