"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { LANG_COOKIE, resolveLang } from "@/lib/i18n";
import { SESSION_COOKIE, SESSION_MAX_AGE, checkPassword, passwordConfigured, sessionToken } from "@/lib/auth";

const prefOpts = { httpOnly: false, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 365 };

export async function setLang(lang: string) {
  (await cookies()).set(LANG_COOKIE, resolveLang(lang), prefOpts);
}

export async function loginAction(_prev: { error: "invalid" | "config" } | undefined, form: FormData) {
  if (!passwordConfigured()) return { error: "config" as const };
  if (!checkPassword(String(form.get("password") ?? ""))) {
    await new Promise((r) => setTimeout(r, 500));
    return { error: "invalid" as const };
  }
  (await cookies()).set(SESSION_COOKIE, sessionToken(), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: SESSION_MAX_AGE });
  redirect("/seo");
}

export async function logoutAction() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}
