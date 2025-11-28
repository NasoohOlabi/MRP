// Wartaqi Bot Entry Point
import 'dotenv/config';
import { Bot } from 'grammy';
import { initializeWartaqiSchema } from './db/init';

export async function startWartaqiBot(): Promise<void> {
  await initializeWartaqiSchema();
  const WARTAQI_BOT_TOKEN = process.env['WARTAQI_BOT_TOKEN']!;

  if (!WARTAQI_BOT_TOKEN) {
    throw new Error('WARTAQI_BOT_TOKEN is not set in environment variables');
  }

  const bot = new Bot(WARTAQI_BOT_TOKEN);

  // Basic start command
  bot.command('start', async (ctx) => {
    await ctx.reply('مرحباً! أنا بوت الورتقي.\n\nWelcome! I am the Wartaqi bot.');
  });

  // Start the bot
  console.log('🤖 Starting Wartaqi bot...');
  await bot.start();
  console.log('✅ Wartaqi bot started successfully');
}

async function main() {
  try {
    await startWartaqiBot();
  } catch (error) {
    // Surface startup errors clearly and exit with a non-zero code
    console.error('Failed to start Wartaqi:', error);
    process.exit(1);
  }
}

main();
