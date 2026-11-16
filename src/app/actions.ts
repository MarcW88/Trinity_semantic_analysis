"use server";
import { cookies } from "next/headers";
import { AuthError } from "next-auth";
import { signIn, signOut } from "@/auth";
import { LANG_COOKIE, resolveLang } from "@/lib/i18n";

const cookieOpts = { httpOnly: false, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 365 };

export async function setLang(lang: string) {
  (await cookies()).set(LANG_COOKIE, resolveLang(lang), cookieOpts);
}

export async function setMarketCookie(market: string) {
  if (/^[A-Z]{4}$/.test(market)) (await cookies()).set("market", market, cookieOpts);
}

export async function loginAction(_prev: { error: boolean } | undefined, form: FormData) {
  try {
    await signIn("credentials", { email: form.get("email"), password: form.get("password"), redirectTo: "/seo" });
    return { error: false };
  } catch (e) {
    if (e instanceof AuthError) return { error: true };
    throw e;
  }
}

export async function logoutAction() {
  await signOut({ redirectTo: "/login" });
}
