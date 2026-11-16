/** Applies SQL migrations and bootstraps the project, markets and the first admin (from env). */
import { config } from "dotenv";
config({ path: [".env.local", ".env"], quiet: true });
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { eq, and } from "drizzle-orm";
import bcrypt from "bcryptjs";
import * as schema from "../src/lib/db/schema";
import { DEFAULT_MARKETS, DEFAULT_PROJECT } from "../src/lib/config";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url && process.argv.includes("--if-db")) {
    console.log("DATABASE_URL not set, skipping migrations");
    return;
  }
  if (!url) throw new Error("DATABASE_URL is required");
  const sql = postgres(url, { max: 1, prepare: false });
  const db = drizzle(sql, { schema });
  await migrate(db, { migrationsFolder: "drizzle" });

  let [project] = await db.select().from(schema.projects).where(eq(schema.projects.slug, DEFAULT_PROJECT.slug));
  if (!project) {
    const domains = (process.env.CLIENT_DOMAINS ?? DEFAULT_PROJECT.clientDomains.join(",")).split(",").map((d) => d.trim().toLowerCase()).filter(Boolean);
    [project] = await db.insert(schema.projects).values({ slug: DEFAULT_PROJECT.slug, name: DEFAULT_PROJECT.name, brandLabel: DEFAULT_PROJECT.brandLabel, clientDomains: domains }).returning();
    console.log(`Created project ${project.slug}`);
  }
  for (const m of DEFAULT_MARKETS) {
    const [exists] = await db.select().from(schema.markets).where(and(eq(schema.markets.projectId, project.id), eq(schema.markets.code, m.code)));
    if (!exists) await db.insert(schema.markets).values({ projectId: project.id, ...m });
  }
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (email && password) {
    const [u] = await db.select().from(schema.users).where(eq(schema.users.email, email));
    if (!u) {
      if (password.length < 10) throw new Error("ADMIN_PASSWORD must be at least 10 characters");
      await db.insert(schema.users).values({ projectId: project.id, email, name: "Admin", role: "admin", passwordHash: await bcrypt.hash(password, 12) });
      console.log(`Created admin ${email}`);
    }
  }
  await sql.end();
  console.log("Migrations applied");
}

main().catch((e) => { console.error(e); process.exit(1); });
