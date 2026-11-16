"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { setLang } from "@/app/actions";
import { UI_LANGS } from "@/lib/config";

export function LangSwitcher({ lang, label }: { lang: string; label: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <select
      aria-label={label}
      className="select"
      value={lang}
      disabled={pending}
      onChange={(e) => start(async () => { await setLang(e.target.value); router.refresh(); })}
    >
      {UI_LANGS.map((l) => <option key={l} value={l}>{l.toUpperCase()}</option>)}
    </select>
  );
}
