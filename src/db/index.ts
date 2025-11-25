// Database connection configuration
import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import * as schema from './schema.js';

const sqlite = new Database('data.db');
export const db = drizzle(sqlite, { schema });


