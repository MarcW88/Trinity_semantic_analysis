import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const SESSION_COOKIE = "dash_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

const configured = () => process.env.DASHBOARD_PASSWORD ?? "";
export const passwordConfigured = () => configured().length > 0;

const sign = (password: string, payload: string) => createHmac("sha256", password).update(`dedecker-dashboard-session-v2|${payload}`).digest("hex");
const same = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

export function checkPassword(input: string): boolean {
  const pw = configured();
  return pw.length > 0 && same(sign(input, "check"), sign(pw, "check"));
}

/** `<issuedAt>.<hmac>` keyed by the password: expires after SESSION_MAX_AGE, and changing DASHBOARD_PASSWORD signs everyone out. */
export function sessionToken(now = Date.now()): string {
  const issued = String(Math.floor(now / 1000));
  return `${issued}.${sign(configured(), issued)}`;
}

export function validSession(value: string | undefined, now = Date.now()): boolean {
  const pw = configured();
  if (!pw || !value) return false;
  const [issued, mac] = value.split(".");
  const age = now / 1000 - Number(issued);
  if (!/^\d+$/.test(issued ?? "") || !mac || age < -60 || age > SESSION_MAX_AGE) return false;
  return same(mac, sign(pw, issued));
}

export async function isAuthenticated(): Promise<boolean> {
  return validSession((await cookies()).get(SESSION_COOKIE)?.value);
}

export async function requirePage() {
  if (!(await isAuthenticated())) redirect("/login");
}
