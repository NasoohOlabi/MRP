import { conversations } from "@grammyjs/conversations";
import * as dotenv from "dotenv";
import { Bot, session } from "grammy";
import type { MyContext, MySession } from "../../types.js";
import { logger } from "../../utils/logger.js";
import { registerCommands } from "../commands/index.js";
import { registerConversations } from "../registerConversations.js";
import { registerTextHandler } from "../textHandler.js";

dotenv.config();

export function createWartaqiBot(): Bot<MyContext> {
  const botToken = process.env["WARTAQI_BOT_TOKEN"];
  if (!botToken) {
    throw new Error("WARTAQI_BOT_TOKEN environment variable is not set");
  }

  const bot = new Bot<MyContext>(botToken);

  bot.use(session({ initial: (): MySession => ({ state: "START", language: "ar" }) }));
  bot.use(conversations());

  registerConversations(bot);
  registerCommands(bot);
  registerTextHandler(bot);

  bot.catch((err) => {
    logger.error("Wartaqi bot error caught", {
      error: err instanceof Error ? err.message : String(err),
      errorStack: err instanceof Error ? err.stack : undefined,
      errorName: err instanceof Error ? err.name : undefined,
    });
  });

  return bot;
}

export async function startWartaqiBot(): Promise<void> {
  const bot = createWartaqiBot();

  try {
    await bot.start();
    logger.info("Wartaqi bot started successfully");
  } catch (error) {
    logger.error("Failed to start Wartaqi bot", {
      error: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
}



