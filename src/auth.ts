import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/lib/db";

export type Role = "admin" | "viewer";

declare module "next-auth" {
  interface Session {
    user: { id: string; role: Role; projectId: number } & DefaultSession["user"];
  }
  interface User {
    role?: Role;
    projectId?: number;
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
        if (!(await bcrypt.compare(parsed.data.password, user.passwordHash))) return null;
        await db.update(schema.users).set({ lastLoginAt: new Date() }).where(eq(schema.users.id, user.id));
        return { id: String(user.id), email: user.email, name: user.name || user.email, role: user.role, projectId: user.projectId };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.projectId = user.projectId;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.sub ?? "";
      session.user.role = (token.role as Role) ?? "viewer";
      session.user.projectId = Number(token.projectId ?? 0);
      return session;
    },
  },
});
export const { GET, POST } = handlers;
