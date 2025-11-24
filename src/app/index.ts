// Application entry point
import { createBot, startBot } from './telegram/bot.js';
import { logger } from '../infrastructure/observability/index.js';

const bot = createBot();

// Handle graceful shutdown
process.on('SIGINT', async () => {
	logger.info('Received SIGINT, shutting down gracefully...');
	await bot.stop();
	process.exit(0);
});

process.on('SIGTERM', async () => {
	logger.info('Received SIGTERM, shutting down gracefully...');
	await bot.stop();
	process.exit(0);
});

// Start the bot
startBot(bot).catch((error) => {
	logger.fatal('Failed to start application', {
		error: error instanceof Error ? error.message : String(error),
		errorStack: error instanceof Error ? error.stack : undefined,
	});
	process.exit(1);
});

