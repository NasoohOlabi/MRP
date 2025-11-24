// Script to create the first admin user
// Usage: bun create-admin.ts <telegram_user_id_or_username>
// Examples:
//   bun create-admin.ts 123456789
//   bun create-admin.ts @username
import * as dotenv from 'dotenv';
import { Bot } from 'grammy';
import { UserService } from './src/features/users/model.js';

dotenv.config();

const userService = new UserService();

async function resolveUserId(input: string): Promise<number | null> {
	// If it's already a number, return it
	const numericId = parseInt(input);
	if (!isNaN(numericId)) {
		return numericId;
	}

	// If it's a username (starts with @), resolve it using Telegram API
	if (input.startsWith('@')) {
		const botToken = process.env['BOT_TOKEN'];
		if (!botToken) {
			console.error('Error: BOT_TOKEN environment variable is not set');
			console.error('Cannot resolve username without bot token.');
			console.error('\nTip: Use /myid command in the bot to get your Telegram User ID');
			return null;
		}

		try {
			const bot = new Bot(botToken);
			const chat = await bot.api.getChat(input); // input already has @
			
			if ('id' in chat) {
				return chat.id;
			} else {
				console.error(`Error: Could not resolve username @${username}`);
				return null;
			}
		} catch (error) {
			console.error(`Error resolving username @${input.slice(1)}:`, error instanceof Error ? error.message : String(error));
			console.error('\nTip: Use /myid command in the bot to get your Telegram User ID');
			return null;
		}
	}

	return null;
}

async function createAdmin() {
	const input = process.argv[2];

	if (!input) {
		console.error('Usage: bun create-admin.ts <telegram_user_id_or_username>');
		console.error('Examples:');
		console.error('  bun create-admin.ts 123456789');
		console.error('  bun create-admin.ts @username');
		console.error('\nTip: Use /myid command in the bot to get your Telegram User ID');
		process.exit(1);
	}

	const userId = await resolveUserId(input);
	if (!userId) {
		process.exit(1);
	}

	try {
		// Get user info from Telegram if possible
		let firstName = 'Admin';
		let lastName = 'User';
		
		if (input.startsWith('@')) {
			try {
				const botToken = process.env['BOT_TOKEN'];
				if (botToken) {
					const bot = new Bot(botToken);
					const chat = await bot.api.getChat(input);
					if ('first_name' in chat) {
						firstName = chat.first_name || 'Admin';
						lastName = chat.last_name || 'User';
					}
				}
			} catch (err) {
				// Ignore errors, use defaults
			}
		}

		// Check if user already exists
		const existing = await userService.getByTelegramId(userId);
		if (existing) {
			if (existing.role === 'admin') {
				console.log(`User ${userId} (${input}) is already an admin.`);
				process.exit(0);
			}
			// Update to admin
			await userService.updateRole(existing.id, 'admin');
			console.log(`User ${userId} (${input}) has been promoted to admin.`);
		} else {
			// Create new admin user
			const user = await userService.register({
				telegramUserId: userId,
				firstName,
				lastName,
				role: 'admin',
			});
			console.log(`Admin user created successfully!`);
			console.log(`User ID: ${user.id}`);
			console.log(`Telegram User ID: ${user.telegramUserId}`);
			console.log(`Name: ${user.firstName} ${user.lastName || ''}`);
			console.log(`Role: ${user.role}`);
		}
	} catch (error) {
		console.error('Error creating admin user:', error instanceof Error ? error.message : String(error));
		process.exit(1);
	}
}

createAdmin();

