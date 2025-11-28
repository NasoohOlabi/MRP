import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import * as schema from "./schema.js";

const sqlite = new Database("WartaqiDB.db");
export const wartaqiDb = drizzle(sqlite, { schema });


