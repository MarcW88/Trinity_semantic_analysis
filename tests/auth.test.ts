import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock("next/navigation", () => ({ redirect: () => undefined }));

describe("session tokens", async () => {
  process.env.DASHBOARD_PASSWORD = "correct horse";
  const { checkPassword, sessionToken, validSession, SESSION_MAX_AGE } = await import("@/lib/auth");
  const now = Date.UTC(2026, 10, 16);

  it("checks the password", () => {
    expect(checkPassword("correct horse")).toBe(true);
    expect(checkPassword("wrong")).toBe(false);
  });

  it("accepts a fresh token and rejects expired, forged or other-password tokens", () => {
    const tok = sessionToken(now);
    expect(validSession(tok, now + 1000)).toBe(true);
    expect(validSession(tok, now + (SESSION_MAX_AGE + 1) * 1000)).toBe(false);
    expect(validSession(tok.replace(/^\d+/, String(Math.floor(now / 1000) + 5)), now)).toBe(false);
    process.env.DASHBOARD_PASSWORD = "new password";
    expect(validSession(tok, now + 1000)).toBe(false);
    process.env.DASHBOARD_PASSWORD = "correct horse";
  });
});
