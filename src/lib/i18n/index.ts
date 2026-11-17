import { fr, type Dict } from "./fr";
import { nl } from "./nl";
import { en } from "./en";
import { DEFAULT_UI_LANG, UI_LANGS, type UiLang } from "../config";

export type { Dict };
export const DICTS: Record<UiLang, Dict> = { fr, nl, en };
export const LANG_COOKIE = "ui_lang";
export const LOCALES: Record<UiLang, string> = { fr: "fr-BE", nl: "nl-BE", en: "en-GB" };

export function resolveLang(value: string | undefined | null): UiLang {
  return UI_LANGS.includes(value as UiLang) ? (value as UiLang) : DEFAULT_UI_LANG;
}

export function t(template: string, params: Record<string, string | number> = {}): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => (k in params ? String(params[k]) : `{${k}}`));
}

export function makeFormat(lang: UiLang) {
  const locale = LOCALES[lang];
  const int = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  const dec1 = new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const pct = new Intl.NumberFormat(locale, { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const date = new Intl.DateTimeFormat(locale, { day: "2-digit", month: "long", year: "numeric", timeZone: "UTC" });
  const dateTime = new Intl.DateTimeFormat(locale, { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Brussels" });
  return {
    int: (n: number | null | undefined) => (n === null || n === undefined ? "—" : int.format(n)),
    dec1: (n: number | null | undefined) => (n === null || n === undefined ? "—" : dec1.format(n)),
    pct: (n: number | null | undefined) => (n === null || n === undefined ? "—" : pct.format(n)),
    date: (iso: string | null | undefined) => (iso ? date.format(new Date(iso.length === 10 ? iso + "T00:00:00Z" : iso)) : "—"),
    dateTime: (iso: string | Date | null | undefined) => (iso ? dateTime.format(new Date(iso)) : "—"),
  };
}
