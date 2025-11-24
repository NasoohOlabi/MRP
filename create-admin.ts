// Script to create the first admin user
// Usage: bun create-admin.ts <telegram_user_id>
import { UserService } from './src/features/users/model.js';

const userService = new UserService();

async function createAdmin() {
	const telegramUserId = process.argv[2];

	if (!telegramUserId) {
		console.error('Usage: bun create-admin.ts <telegram_user_id>');
		console.error('Example: bun create-admin.ts 123456789');
		process.exit(1);
	}

	const userId = parseInt(telegramUserId);
	if (isNaN(userId)) {
		console.error('Error: Telegram User ID must be a number');
		process.exit(1);
	}

	try {
		// Check if user already exists
		const existing = await userService.getByTelegramId(userId);
		if (existing) {
			if (existing.role === 'admin') {
				console.log(`User ${userId} is already an admin.`);
				process.exit(0);
			}
			// Update to admin
			await userService.updateRole(existing.id, 'admin');
			console.log(`User ${userId} has been promoted to admin.`);
		} else {
			// Create new admin user
			const user = await userService.register({
				telegramUserId: userId,
				firstName: 'Admin',
				lastName: 'User',
				role: 'admin',
			});
			console.log(`Admin user created successfully!`);
			console.log(`User ID: ${user.id}`);
			console.log(`Telegram User ID: ${user.telegramUserId}`);
			console.log(`Role: ${user.role}`);
		}
	} catch (error) {
		console.error('Error creating admin user:', error instanceof Error ? error.message : String(error));
		process.exit(1);
	}
}

createAdmin();

