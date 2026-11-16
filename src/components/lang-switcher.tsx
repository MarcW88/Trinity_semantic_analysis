"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { setLang } from "@/app/actions";
import { UI_LANGS, type UiLang } from "@/lib/config";
import { Segmented } from "./motion";

export function LangSwitcher({ lang, label }: { lang: UiLang; label: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Segmented label={label} layoutId="lang-pill" value={lang} disabled={pending}
      options={UI_LANGS.map((l) => ({ value: l, label: l.toUpperCase() }))}
      onChange={(l) => start(async () => { await setLang(l); router.refresh(); })} />
  );
}
