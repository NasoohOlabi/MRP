import type { Bot } from "grammy";
import { getRecentParentInquiries, type ParentInquiry } from "../../features/parents/parentInquiryStore.js";
import type { MyContext } from "../../types.js";
import { getCurrentUser, requireAdmin, requireTeacher } from "../../utils/auth.js";
import { t } from "../../utils/i18n.js";
import { logger } from "../../utils/logger.js";
import { exitLLMMode, formatDate, getLang } from "../helpers.js";
import {
  attendanceService,
  memorizationService,
  studentService,
  teacherService,
} from "../services.js";

export function registerCommands(bot: Bot<MyContext>): void {
  bot.command("start", async (ctx) => {
    const lang = getLang(ctx);
    logger.info("Command received: /start", { userId: ctx.from?.id, chatId: ctx.chat?.id });
    exitLLMMode(ctx);

    if (!ctx.from?.id) {
      await ctx.reply(lang === "ar" ? "لا يمكن الحصول على معلومات المستخدم." : "Cannot get user information.");
      return;
    }

    const user = await getCurrentUser(ctx);

    if (!user) {
      await ctx.reply(t("start_unknown", lang));
      return;
    }

    if (!user.isActive) {
      await ctx.reply(t("account_inactive", lang));
      return;
    }

    if (user.role === "admin") {
      await ctx.reply(t("start_admin", lang), { parse_mode: "Markdown" });
    } else if (user.role === "student") {
      await ctx.reply(t("start_student", lang), { parse_mode: "Markdown" });
    } else if (user.role === "teacher") {
      await ctx.reply(t("start_teacher", lang), { parse_mode: "Markdown" });
    } else if (user.role === "parent") {
      await ctx.reply(t("start_parent", lang), { parse_mode: "Markdown" });
    } else {
      await ctx.reply(t("start_unknown", lang));
    }
  });

  bot.command("register", async (ctx) => {
    logger.info("Command received: /register", { userId: ctx.from?.id, chatId: ctx.chat?.id });
    exitLLMMode(ctx);
    await ctx.conversation.enter("register_user");
  });

  bot.command("profile", async (ctx) => {
    logger.info("Command received: /profile", { userId: ctx.from?.id, chatId: ctx.chat?.id });
    exitLLMMode(ctx);
    await ctx.conversation.enter("view_profile");
  });

  bot.command("myid", async (ctx) => {
    const lang = getLang(ctx);
    logger.info("Command received: /myid", { userId: ctx.from?.id, chatId: ctx.chat?.id });
    exitLLMMode(ctx);

    if (!ctx.from?.id) {
      await ctx.reply(t("error_user_info_unavailable", lang));
      return;
    }

    const userId = ctx.from.id;
    const username = ctx.from.username ? `@${ctx.from.username}` : "N/A";
    const firstName = ctx.from.first_name || "N/A";
    const lastName = ctx.from.last_name || "";

    const message =
      t("telegram_info_title", lang) +
      `\n\n${t("telegram_info_id", lang).replace("{userId}", `\`${userId}\``)}\n` +
      `${t("telegram_info_username", lang).replace("{username}", username)}\n` +
      `${t("telegram_info_name", lang).replace("{firstName}", firstName).replace("{lastName}", lastName)}\n` +
      `\n${t("telegram_info_admin_command", lang).replace("{userId}", `\`bun create-admin.ts ${userId}\``)}`;

    await ctx.reply(message, { parse_mode: "Markdown" });
  });

  bot.command("assignrole", async (ctx) => {
    logger.info("Command received: /assignrole", { userId: ctx.from?.id, chatId: ctx.chat?.id });
    if (ctx.session?.inLLMMode) {
      ctx.session.inLLMMode = false;
    }
    if (await requireAdmin(ctx)) {
      await ctx.conversation.enter("assign_role");
    }
  });

  bot.command("users", async (ctx) => {
    logger.info("Command received: /users", { userId: ctx.from?.id, chatId: ctx.chat?.id });
    if (ctx.session?.inLLMMode) {
      ctx.session.inLLMMode = false;
    }
    if (await requireAdmin(ctx)) {
      await ctx.conversation.enter("list_users");
    }
  });

  bot.command("parentleads", async (ctx) => {
    const lang = getLang(ctx);
    logger.info("Command received: /parentleads", { userId: ctx.from?.id, chatId: ctx.chat?.id });
    exitLLMMode(ctx);
    if (!(await requireAdmin(ctx))) {
      return;
    }
    const inquiries = await getRecentParentInquiries(10);
    if (inquiries.length === 0) {
      await ctx.reply(t("parent_inquiry_list_empty", lang));
      return;
    }
    const header = t("parent_inquiry_list_title", lang);
    const lines = inquiries.map((inquiry, index) => formatParentInquiryEntry(inquiry, index, lang)).join("\n\n");
    await ctx.reply(`${header}\n\n${lines}`);
  });

  bot.command("tryllm", async (ctx) => {
    const lang = getLang(ctx);
    logger.info("Command received: /tryllm", { userId: ctx.from?.id, chatId: ctx.chat?.id });
    if (await requireAdmin(ctx)) {
      ctx.session.inLLMMode = true;
      if (!ctx.session.lmStudioHistory) {
        ctx.session.lmStudioHistory = [];
      }
      await ctx.reply(t("llm_mode_entered", lang));
    }
  });

  bot.command("students", async (ctx) => {
    logger.info("Command received: /students", { userId: ctx.from?.id, chatId: ctx.chat?.id });
    exitLLMMode(ctx);
    if (await requireTeacher(ctx)) {
      await ctx.conversation.enter("students");
    }
  });

  bot.command("teachers", async (ctx) => {
    logger.info("Command received: /teachers", { userId: ctx.from?.id, chatId: ctx.chat?.id });
    exitLLMMode(ctx);
    if (await requireTeacher(ctx)) {
      await ctx.conversation.enter("teachers");
    }
  });

  bot.command("attendance", async (ctx) => {
    logger.info("Command received: /attendance", { userId: ctx.from?.id, chatId: ctx.chat?.id });
    exitLLMMode(ctx);
    if (await requireTeacher(ctx)) {
      await ctx.conversation.enter("attendance");
    }
  });

  bot.command("memorize", async (ctx) => {
    logger.info("Command received: /memorize", { userId: ctx.from?.id, chatId: ctx.chat?.id });
    exitLLMMode(ctx);
    if (await requireTeacher(ctx)) {
      await ctx.conversation.enter("memorization");
    }
  });

  bot.command("help", async (ctx) => {
    const lang = getLang(ctx);
    logger.info("Command received: /help", { userId: ctx.from?.id, chatId: ctx.chat?.id });
    exitLLMMode(ctx);

    if (!ctx.from?.id) {
      await ctx.reply(lang === "ar" ? "لا يمكن الحصول على معلومات المستخدم." : "Cannot get user information.");
      return;
    }

    const user = await getCurrentUser(ctx);

    if (!user) {
      await ctx.reply(t("start_unknown", lang));
      return;
    }

    if (!user.isActive) {
      await ctx.reply(t("account_inactive", lang));
      return;
    }

    if (user.role === "admin") {
      await ctx.reply(t("start_admin", lang), { parse_mode: "Markdown" });
    } else if (user.role === "student") {
      await ctx.reply(t("start_student", lang), { parse_mode: "Markdown" });
    } else if (user.role === "teacher") {
      await ctx.reply(t("start_teacher", lang), { parse_mode: "Markdown" });
    } else if (user.role === "parent") {
      await ctx.reply(t("start_parent", lang), { parse_mode: "Markdown" });
    } else {
      await ctx.reply(t("start_unknown", lang));
    }
  });

  bot.command("myinfo", async (ctx) => {
    const lang = getLang(ctx);
    logger.info("Command received: /myinfo", { userId: ctx.from?.id, chatId: ctx.chat?.id });
    exitLLMMode(ctx);

    if (!ctx.from?.id) {
      await ctx.reply(lang === "ar" ? "لا يمكن الحصول على معلومات المستخدم." : "Cannot get user information.");
      return;
    }

    const user = await getCurrentUser(ctx);
    if (!user || user.role !== "student" || !user.isActive) {
      await ctx.reply(
        lang === "ar"
          ? "ليس لديك صلاحية للوصول إلى هذا الأمر."
          : "You don't have permission to access this command."
      );
      return;
    }

    if (!user.linkedStudentId) {
      await ctx.reply(t("not_linked_student", lang));
      return;
    }

    const student = await studentService.getById(user.linkedStudentId);
    if (!student) {
      await ctx.reply(t("not_linked_student", lang));
      return;
    }

    let teacherName = t("student_info_no_teacher", lang);
    if (student.group) {
      const teachers = await teacherService.getAll();
      const found = teachers.find((tchr) => tchr.group === student.group);
      if (found) {
        teacherName = `${found.firstName} ${found.lastName}`;
      }
    }

    const groupText = student.group || t("student_info_no_group", lang);
    const message =
      t("student_info_title", lang) +
      `\n\n${t("student_info_name", lang).replace("{name}", `${student.firstName} ${student.lastName}`)}\n` +
      `${t("student_info_group", lang).replace("{group}", groupText)}\n` +
      `${t("student_info_teacher", lang).replace("{teacher}", teacherName)}`;

    await ctx.reply(message, { parse_mode: "Markdown" });
  });

  bot.command("mymemorization", async (ctx) => {
    const lang = getLang(ctx);
    logger.info("Command received: /mymemorization", { userId: ctx.from?.id, chatId: ctx.chat?.id });
    exitLLMMode(ctx);

    if (!ctx.from?.id) {
      await ctx.reply(lang === "ar" ? "لا يمكن الحصول على معلومات المستخدم." : "Cannot get user information.");
      return;
    }

    const user = await getCurrentUser(ctx);
    if (!user || user.role !== "student" || !user.isActive) {
      await ctx.reply(
        lang === "ar"
          ? "ليس لديك صلاحية للوصول إلى هذا الأمر."
          : "You don't have permission to access this command."
      );
      return;
    }

    if (!user.linkedStudentId) {
      await ctx.reply(t("not_linked_student", lang));
      return;
    }

    const { records, total } = await memorizationService.getStudentMemorizations(user.linkedStudentId, { limit: 20 });

    if (records.length === 0) {
      await ctx.reply(t("my_memorization_none", lang));
      return;
    }

    const recordsText = records
      .map((r) =>
        t("my_memorization_page", lang)
          .replace("{page}", String(r.page))
          .replace("{date}", formatDate(r.createdAt, lang))
      )
      .join("\n");

    const message =
      `${t("my_memorization_title", lang)}\n\n` +
      `${t("my_memorization_total", lang).replace("{total}", String(total))}\n\n` +
      recordsText;

    await ctx.reply(message, { parse_mode: "Markdown" });
  });

  bot.command("myattendance", async (ctx) => {
    const lang = getLang(ctx);
    logger.info("Command received: /myattendance", { userId: ctx.from?.id, chatId: ctx.chat?.id });
    exitLLMMode(ctx);

    if (!ctx.from?.id) {
      await ctx.reply(lang === "ar" ? "لا يمكن الحصول على معلومات المستخدم." : "Cannot get user information.");
      return;
    }

    const user = await getCurrentUser(ctx);
    if (!user || user.role !== "student" || !user.isActive) {
      await ctx.reply(
        lang === "ar"
          ? "ليس لديك صلاحية للوصول إلى هذا الأمر."
          : "You don't have permission to access this command."
      );
      return;
    }

    if (!user.linkedStudentId) {
      await ctx.reply(t("not_linked_student", lang));
      return;
    }

    const { records, total } = await attendanceService.getStudentAttendance(user.linkedStudentId, { limit: 20 });

    if (records.length === 0) {
      await ctx.reply(t("my_attendance_none", lang));
      return;
    }

    const recordsText = records
      .map((r) =>
        t("my_attendance_record", lang)
          .replace("{event}", r.event)
          .replace("{date}", formatDate(r.createdAt, lang))
      )
      .join("\n");

    const message =
      `${t("my_attendance_title", lang)}\n\n` +
      `${t("my_attendance_total", lang).replace("{total}", String(total))}\n\n` +
      recordsText;

    await ctx.reply(message, { parse_mode: "Markdown" });
  });

  bot.command("mygroup", async (ctx) => {
    await handleStudentGroupOrTeacher(ctx, "group");
  });

  bot.command("myteacher", async (ctx) => {
    await handleStudentGroupOrTeacher(ctx, "teacher");
  });
}

async function handleStudentGroupOrTeacher(ctx: MyContext, type: "group" | "teacher") {
  const lang = getLang(ctx);
  logger.info(`Command received: /my${type}`, { userId: ctx.from?.id, chatId: ctx.chat?.id });
  exitLLMMode(ctx);

  if (!ctx.from?.id) {
    await ctx.reply(t("cannot_get_user_info", lang));
    return;
  }
  if (!ctx.from?.id) {
    await ctx.reply(t("cannot_get_user_info", lang));
    return;
  }

  const user = await getCurrentUser(ctx);
  if (!user || user.role !== "student" || !user.isActive) {
    await ctx.reply(
      lang === "ar"
        ? "ليس لديك صلاحية للوصول إلى هذا الأمر."
        : "You don't have permission to access this command."
    );
    return;
  }

  if (!user.linkedStudentId) {
    await ctx.reply(t("not_linked_student", lang));
    return;
  }

  const student = await studentService.getById(user.linkedStudentId);
  if (!student) {
    await ctx.reply(t("not_linked_student", lang));
    return;
  }

  if (type === "group") {
    const groupText = student.group || t("student_info_no_group", lang);
    const message = lang === "ar" ? `**مجموعتك:** ${groupText}` : `**Your Group:** ${groupText}`;
    await ctx.reply(message, { parse_mode: "Markdown" });
    return;
  }

  let teacherName = t("student_info_no_teacher", lang);
  if (student.group) {
    const teachers = await teacherService.getAll();
    const teacher = teachers.find((tchr) => tchr.group === student.group);
    if (teacher) {
      teacherName = `${teacher.firstName} ${teacher.lastName}`;
    }
  }
  const message = lang === "ar" ? `**معلمك:** ${teacherName}` : `**Your Teacher:** ${teacherName}`;
  await ctx.reply(message, { parse_mode: "Markdown" });
}

function formatParentInquiryEntry(inquiry: ParentInquiry, index: number, lang: string): string {
  const date = inquiry.createdAt ? new Date(inquiry.createdAt) : new Date();
  const dateText = formatDate(date, lang);
  const missing = lang === "ar" ? "—" : "—";
  if (lang === "ar") {
    return `${index + 1}.\n• ولي الأمر: ${inquiry.parentName}\n• التواصل: ${inquiry.contact || missing}\n• الطفل: ${inquiry.childName}\n• العمر/الصف: ${inquiry.childAgeOrGrade || missing}\n• البرنامج: ${inquiry.programPreference || missing}\n• ملاحظات: ${inquiry.notes || missing}\n• التاريخ: ${dateText}`;
  }
  return `${index + 1}.\n• Parent: ${inquiry.parentName}\n• Contact: ${inquiry.contact || missing}\n• Child: ${inquiry.childName}\n• Age/Grade: ${inquiry.childAgeOrGrade || missing}\n• Program: ${inquiry.programPreference || missing}\n• Notes: ${inquiry.notes || missing}\n• Received: ${dateText}`;
}

