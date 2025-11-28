// Setup script to initialize Wartaqi database schema using Drizzle Kit
import { $ } from 'bun';
import { existsSync } from 'fs';
import { resolve } from 'path';

const DRIZZLE_CONFIG = 'drizzle.wartaqi.config.json';

async function setupDatabase() {
	try {
		console.log('🔧 Syncing Wartaqi database schema with Drizzle definitions...\n');

		const configPath = resolve(process.cwd(), DRIZZLE_CONFIG);

		if (!existsSync(configPath)) {
			throw new Error(`Drizzle config not found at ${configPath}`);
		}

		await $`bunx drizzle-kit push --config ${configPath}`;

		console.log('\n✅ Database schema synced successfully!');
	} catch (error) {
		console.error('❌ Error syncing database schema with Drizzle:', error);
		process.exit(1);
	}
}

setupDatabase();