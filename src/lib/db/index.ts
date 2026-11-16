import postgres from "postgres";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

export type Db = PostgresJsDatabase<typeof schema>;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

const globalForDb = globalThis as unknown as { pgClient?: ReturnType<typeof postgres>; db?: Db };

/** Connects on first use so `next build` can run without DATABASE_URL. */
function getDb(): Db {
  if (globalForDb.db) return globalForDb.db;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not configured");
  const client = globalForDb.pgClient ?? postgres(url, { max: process.env.VERCEL ? 3 : 10, prepare: false });
  if (process.env.NODE_ENV !== "production") globalForDb.pgClient = client;
  globalForDb.db = drizzle(client, { schema });
  return globalForDb.db;
}

export const db = new Proxy({} as Db, {
  get(_target, prop) {
    const real = getDb();
    const value = Reflect.get(real, prop, real);
    return typeof value === "function" ? value.bind(real) : value;
  },
});
export { schema };
