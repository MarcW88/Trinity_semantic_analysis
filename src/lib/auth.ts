import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const SESSION_COOKIE = "dash_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

const configured = () => process.env.DASHBOARD_PASSWORD ?? "";
export const passwordConfigured = () => configured().length > 0;

/** Session token derived from the password: changing DASHBOARD_PASSWORD signs everyone out. */
const tokenFor = (password: string) => createHmac("sha256", password).update("dedecker-dashboard-session-v1").digest("hex");
const same = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

export function checkPassword(input: string): boolean {
  const pw = configured();
  return pw.length > 0 && same(tokenFor(input), tokenFor(pw));
}

export const sessionToken = () => tokenFor(configured());

export async function isAuthenticated(): Promise<boolean> {
  const pw = configured();
  if (!pw) return false;
  const value = (await cookies()).get(SESSION_COOKIE)?.value;
  return !!value && same(value, tokenFor(pw));
}

export async function requirePage() {
  if (!(await isAuthenticated())) redirect("/login");
}
