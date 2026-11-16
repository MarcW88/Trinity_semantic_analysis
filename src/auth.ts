import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/lib/db";
import { LOGIN_LOCK } from "@/lib/config";

export type Role = "admin" | "viewer";

declare module "next-auth" {
  interface Session {
    user: { id: string; role: Role; projectId: number; sessionVersion: number } & DefaultSession["user"];
  }
  interface User {
    role?: Role;
    projectId?: number;
    sessionVersion?: number;
  }
}

const credentialsSchema = z.object({ email: z.string().email().max(200), password: z.string().min(1).max(200) });

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;
        const email = parsed.data.email.trim().toLowerCase();
        const [user] = await db.select().from(schema.users).where(eq(schema.users.email, email)).limit(1);
        if (!user || !user.active) return null;
        if (user.lockedUntil && user.lockedUntil > new Date()) return null;
        if (!(await bcrypt.compare(parsed.data.password, user.passwordHash))) {
          const [f] = await db.update(schema.users).set({ failedLogins: sql`${schema.users.failedLogins} + 1` })
            .where(eq(schema.users.id, user.id)).returning({ failedLogins: schema.users.failedLogins });
          if (f && f.failedLogins >= LOGIN_LOCK.maxAttempts) {
            await db.update(schema.users).set({ failedLogins: 0, lockedUntil: new Date(Date.now() + LOGIN_LOCK.minutes * 60_000) }).where(eq(schema.users.id, user.id));
          }
          return null;
        }
        await db.update(schema.users).set({ lastLoginAt: new Date(), failedLogins: 0, lockedUntil: null }).where(eq(schema.users.id, user.id));
        return { id: String(user.id), email: user.email, name: user.name || user.email, role: user.role, projectId: user.projectId, sessionVersion: user.sessionVersion };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.projectId = user.projectId;
        token.sv = user.sessionVersion;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.sub ?? "";
      session.user.role = (token.role as Role) ?? "viewer";
      session.user.projectId = Number(token.projectId ?? 0);
      session.user.sessionVersion = Number(token.sv ?? -1);
      return session;
    },
  },
});
export const { GET, POST } = handlers;
