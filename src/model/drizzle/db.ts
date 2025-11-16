import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import * as schema from './schema';
const sqlite = new Database('data.db');   // <-- file created/opened here
export const db = drizzle(sqlite, { schema });
