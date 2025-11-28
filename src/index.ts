// Wartaqi Bot Entry Point
import 'dotenv/config';
import { startWartaqiBot as startWartaqiConversationsBot } from './bot/wartaqi/index.js';

export async function startWartaqiBot(): Promise<void> {
  await startWartaqiConversationsBot();
}

async function main() {
  try {
    await startWartaqiBot();
  } catch (error) {
    console.error('Failed to start Wartaqi:', error);
    process.exit(1);
  }
}

main();
