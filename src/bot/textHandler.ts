import type { Bot } from "grammy";
import type { MyContext } from "../types.js";
import { getCurrentUser, requireTeacher } from "../utils/auth.js";
import { t } from "../utils/i18n.js";
import { createSystemPrompt, queryLMStudio, sanitizeTelegramMarkdown } from "../utils/lmStudio.js";
import { logger } from "../utils/logger.js";
import { exitLLMMode, getLang } from "./helpers.js";
import { studentService, teacherService } from "./services.js";

export function registerTextHandler(bot: Bot<MyContext>): void {
  bot.on("message:text", async (ctx) => {
    const messageText = ctx.message.text;
    const lang = getLang(ctx);

    if (messageText.startsWith("/")) {
      return;
    }

    if (!ctx.from?.id) {
      return;
    }

    const user = await getCurrentUser(ctx);

    if (user && user.isActive && user.role === "admin" && ctx.session?.inLLMMode) {
      try {
        await ctx.api.sendChatAction(ctx.chat.id, "typing");
        const history = ctx.session.lmStudioHistory || [];
        const systemPrompt = await createSystemPrompt(lang as "en" | "ar");
        const response = await queryLMStudio(messageText, systemPrompt, {}, history);
        const sanitizedResponse = sanitizeTelegramMarkdown(response);

        if (!ctx.session.lmStudioHistory) {
          ctx.session.lmStudioHistory = [];
        }
        ctx.session.lmStudioHistory.push(
          { role: "user", content: messageText },
          { role: "assistant", content: sanitizedResponse }
        );
        if (ctx.session.lmStudioHistory.length > 10) {
          ctx.session.lmStudioHistory = ctx.session.lmStudioHistory.slice(-10);
        }

        try {
          await ctx.reply(sanitizedResponse, { parse_mode: "Markdown" });
        } catch (markdownError) {
          logger.warn("Markdown parsing failed, sending as plain text", {
            error: markdownError instanceof Error ? markdownError.message : String(markdownError),
          });
          await ctx.reply(sanitizedResponse);
        }
      } catch (error) {
        logger.error("Error processing LLM request", {
          error: error instanceof Error ? error.message : String(error),
        });
        await ctx.reply(t("llm_error", lang));
      }
      return;
    }

    if (!user || !user.isActive) {
      try {
        await ctx.reply(t("identifying_user", lang));
        const history = ctx.session.lmStudioHistory || [];
        const systemPrompt = lang === "ar"
          ? "أنت مساعد ودود ومرحب في بوت MRP. أنت تساعد أولياء الأمور والطلاب والمعلمين.\n\nعندما يخبرك المستخدم عن دوره (مثل \"أنا طالب\" أو \"أنا معلم\"), رحب به واشرح له ما يمكنه فعله بطريقة بسيطة وودودة. اسأل أسئلة لفهم ما يحتاجه.\n\nعندما يرسل المستخدم معلوماته الشخصية، حاول استخراج: الاسم الكامل، رقم الهاتف (إن وجد)، والمعلومات الأخرى ذات الصلة.\n\n**مهم:**\n- لا تستخدم جداول markdown - استخدم قوائم بسيطة بنقاط\n- استخدم markdown متوافق مع Telegram: `*عريض*`, `_مائل_`\n- كن محادثاً وودوداً، وليس تقنياً\n- اسأل أسئلة لفهم احتياجات المستخدم"
          : "You are a friendly and welcoming assistant for the MRP bot. You help parents, students, and teachers.\n\nWhen a user tells you about their role (like \"I'm a student\" or \"I'm a teacher\"), welcome them and explain what they can do in a simple, friendly way. Ask questions to understand what they need.\n\nWhen a user sends their personal information, try to extract: full name, phone number (if available), and other relevant information.\n\n**Important:**\n- NEVER use markdown tables - use simple bullet point lists instead\n- Use Telegram-compatible markdown: `*bold*`, `_italic_`\n- Be conversational and friendly, not technical\n- Ask questions to understand the user's needs";
        const response = await queryLMStudio(messageText, systemPrompt, {}, history);
        const sanitizedResponse = sanitizeTelegramMarkdown(response);

        if (!ctx.session.lmStudioHistory) {
          ctx.session.lmStudioHistory = [];
        }
        ctx.session.lmStudioHistory.push(
          { role: "user", content: messageText },
          { role: "assistant", content: sanitizedResponse }
        );
        if (ctx.session.lmStudioHistory.length > 10) {
          ctx.session.lmStudioHistory = ctx.session.lmStudioHistory.slice(-10);
        }

        try {
          await ctx.reply(sanitizedResponse, { parse_mode: "Markdown" });
        } catch (markdownError) {
          logger.warn("Markdown parsing failed, sending as plain text", {
            error: markdownError instanceof Error ? markdownError.message : String(markdownError),
          });
          await ctx.reply(sanitizedResponse);
        }

        const students = await studentService.getAll();
        const teachers = await teacherService.getAll();
        const searchLower = messageText.toLowerCase();
        let found = false;

        for (const student of students) {
          const fullName = `${student.firstName} ${student.lastName}`.toLowerCase();
          if (fullName.includes(searchLower) || searchLower.includes(fullName)) {
            await ctx.reply(
              lang === "ar"
                ? `تم العثور على طالب مطابق: ${student.firstName} ${student.lastName}\n\nيرجى استخدام /register للتسجيل.`
                : `Found matching student: ${student.firstName} ${student.lastName}\n\nPlease use /register to register.`
            );
            found = true;
            break;
          }
        }

        if (!found) {
          for (const teacher of teachers) {
            const fullName = `${teacher.firstName} ${teacher.lastName}`.toLowerCase();
            if (fullName.includes(searchLower) || searchLower.includes(fullName)) {
              await ctx.reply(
                lang === "ar"
                  ? `تم العثور على معلم مطابق: ${teacher.firstName} ${teacher.lastName}\n\nيرجى استخدام /register للتسجيل.`
                  : `Found matching teacher: ${teacher.firstName} ${teacher.lastName}\n\nPlease use /register to register.`
              );
              found = true;
              break;
            }
          }
        }

        if (!found) {
          await ctx.reply(t("could_not_identify", lang));
        }
      } catch (error) {
        logger.error("Error identifying user with LLM", {
          error: error instanceof Error ? error.message : String(error),
        });
        await ctx.reply(t("could_not_identify", lang));
      }
      return;
    }

    if (ctx.session?.state === "START") {
      if (messageText === "/student") {
        logger.info("Text command received: /student", { userId: ctx.from?.id, chatId: ctx.chat?.id });
        exitLLMMode(ctx);
        if (await requireTeacher(ctx)) {
          await ctx.conversation.enter("students");
        }
      } else if (messageText === "/teacher") {
        logger.info("Text command received: /teacher", { userId: ctx.from?.id, chatId: ctx.chat?.id });
        exitLLMMode(ctx);
        if (await requireTeacher(ctx)) {
          await ctx.conversation.enter("teachers");
        }
      } else if (messageText === "/attendance") {
        logger.info("Text command received: /attendance", { userId: ctx.from?.id, chatId: ctx.chat?.id });
        exitLLMMode(ctx);
        if (await requireTeacher(ctx)) {
          await ctx.conversation.enter("attendance");
        }
      } else if (messageText === "/memorize") {
        logger.info("Text command received: /memorize", { userId: ctx.from?.id, chatId: ctx.chat?.id });
        exitLLMMode(ctx);
        if (await requireTeacher(ctx)) {
          await ctx.conversation.enter("memorization");
        }
      }
    }
  });
}

