import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set. See .env.example.");

// One pooled client per server instance. `prepare: false` keeps it compatible
// with Neon's pooled (PgBouncer) connection string.
const client = postgres(url, { prepare: false, max: 5 });

export const db = drizzle(client, { schema, casing: "snake_case" });
export type DB = typeof db;
