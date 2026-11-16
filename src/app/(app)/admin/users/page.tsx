import { asc, eq } from "drizzle-orm";
import { requirePageUser } from "@/lib/auth/guard";
import { getDict } from "@/lib/i18n/server";
import { makeFormat } from "@/lib/i18n";
import { db, schema } from "@/lib/db";
import { UsersAdmin } from "@/components/admin/users-admin";

export default async function UsersPage() {
  const me = await requirePageUser("admin");
  const { d, lang } = await getDict();
  const f = makeFormat(lang);
  const users = await db.select().from(schema.users).where(eq(schema.users.projectId, me.projectId)).orderBy(asc(schema.users.email));
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{d.users.title}</h1>
      <UsersAdmin
        meId={me.id}
        labels={d.users}
        users={users.map((u) => ({ id: u.id, email: u.email, name: u.name, role: u.role, active: u.active, lastLogin: f.dateTime(u.lastLoginAt) }))}
      />
    </div>
  );
}
