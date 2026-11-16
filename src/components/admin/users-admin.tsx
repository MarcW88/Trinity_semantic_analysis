"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Dict } from "@/lib/i18n";

type U = { id: number; email: string; name: string; role: "admin" | "viewer"; active: boolean; lastLogin: string };

export function UsersAdmin({ users, labels, meId }: { users: U[]; labels: Dict["users"]; meId: number }) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const call = async (body: unknown) => {
    const res = await fetch("/api/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const json = await res.json().catch(() => ({}));
    setMsg(res.ok ? null : json.error ?? String(res.status));
    router.refresh();
    return res.ok;
  };
  return (
    <div className="space-y-4">
      <form className="card flex flex-wrap items-end gap-2" onSubmit={async (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const ok = await call({ action: "create", email: fd.get("email"), name: fd.get("name"), role: fd.get("role"), password: fd.get("password") });
        if (ok) { setMsg(labels.created); e.currentTarget.reset(); }
      }}>
        <label className="text-sm">{labels.email}<input name="email" type="email" required className="input mt-1 block" /></label>
        <label className="text-sm">{labels.name}<input name="name" className="input mt-1 block" /></label>
        <label className="text-sm">{labels.role}
          <select name="role" className="select mt-1 block"><option value="viewer">{labels.viewer}</option><option value="admin">{labels.admin}</option></select>
        </label>
        <label className="text-sm">{labels.password}<input name="password" type="password" minLength={10} required autoComplete="new-password" className="input mt-1 block" /></label>
        <button className="btn" type="submit">{labels.create}</button>
        {msg && <p role="status" className="w-full text-sm">{msg}</p>}
      </form>
      <div className="card overflow-x-auto">
        <table className="tbl">
          <thead><tr><th scope="col">{labels.email}</th><th scope="col">{labels.name}</th><th scope="col">{labels.role}</th><th scope="col">{labels.active}</th><th scope="col">{labels.lastLogin}</th><th scope="col" /></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.email}</td><td>{u.name}</td>
                <td>
                  <select className="select" value={u.role} disabled={u.id === meId} aria-label={labels.role} onChange={(e) => call({ action: "update", id: u.id, role: e.target.value })}>
                    <option value="viewer">{labels.viewer}</option><option value="admin">{labels.admin}</option>
                  </select>
                </td>
                <td>{u.active ? "✓" : "—"}</td><td>{u.lastLogin}</td>
                <td className="space-x-2 whitespace-nowrap">
                  {u.id !== meId && <button className="btn-ghost" onClick={() => call({ action: "update", id: u.id, active: !u.active })}>{u.active ? labels.deactivate : labels.activate}</button>}
                  {u.id !== meId && <button className="btn-ghost" onClick={() => { const p = window.prompt(labels.resetPassword); if (p) call({ action: "update", id: u.id, password: p }); }}>{labels.resetPassword}</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
