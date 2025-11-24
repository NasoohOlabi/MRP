// Unit of Work pattern for transaction management
import { db } from './db.js';

export interface UnitOfWork {
	execute<T>(fn: (tx: typeof db) => Promise<T>): Promise<T>;
}

/**
 * Simple Unit of Work implementation
 * For SQLite, transactions are handled via BEGIN/COMMIT/ROLLBACK
 * Note: Drizzle's transaction() method handles this automatically
 */
export class SqliteUnitOfWork implements UnitOfWork {
	async execute<T>(fn: (tx: typeof db) => Promise<T>): Promise<T> {
		return db.transaction(async (tx) => {
			return fn(tx);
		});
	}
}

export const unitOfWork = new SqliteUnitOfWork();

