import { conversations } from "@grammyjs/conversations";
import * as dotenv from "dotenv";
import { Bot, session } from "grammy";
import type { MyContext, MySession } from "../types.js";
import { logger } from "../utils/logger.js";
import { registerCommands } from "./commands/index.js";
import { registerConversations } from "./registerConversations.js";
import { registerTextHandler } from "./textHandler.js";

dotenv.config();

export function createBot(): Bot<MyContext> {
  const botToken = process.env["BOT_TOKEN"];
  if (!botToken) {
    throw new Error("BOT_TOKEN environment variable is not set");
  }
  const bot = new Bot<MyContext>(botToken);

  bot.use(session({ initial: (): MySession => ({ state: "START", language: "en" }) }));
  bot.use(conversations());

  registerConversations(bot);
  registerCommands(bot);
  registerTextHandler(bot);

  bot.catch((err) => {
    logger.error("Bot error caught", {
      error: err instanceof Error ? err.message : String(err),
      errorStack: err instanceof Error ? err.stack : undefined,
      errorName: err instanceof Error ? err.name : undefined,
    });
  });

  return bot;
}

export async function startBot(): Promise<void> {
  const bot = createBot();

  try {
    await bot.start();
    logger.info("Bot started successfully");
  } catch (error) {
    logger.error("Failed to start bot", {
      error: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
}

