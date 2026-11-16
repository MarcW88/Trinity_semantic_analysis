"use client";
import { useActionState } from "react";
import { loginAction } from "../actions";
import type { Dict } from "@/lib/i18n";

export function LoginForm({ labels }: { labels: Dict["login"] }) {
  const [state, action, pending] = useActionState(loginAction, undefined);
  return (
    <form action={action} className="space-y-3">
      <label className="block text-sm">
        {labels.email}
        <input name="email" type="email" required autoComplete="username" className="input mt-1 w-full" />
      </label>
      <label className="block text-sm">
        {labels.password}
        <input name="password" type="password" required autoComplete="current-password" className="input mt-1 w-full" />
      </label>
      {state?.error && <p role="alert" className="text-sm text-red-700">{labels.error}</p>}
      <button type="submit" disabled={pending} className="btn w-full justify-center">{labels.submit}</button>
    </form>
  );
}
