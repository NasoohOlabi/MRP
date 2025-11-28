import type { Conversation } from "@grammyjs/conversations";
import type { BaseContext, MyContext } from "../../../../types.js";
import { t } from "../../../../utils/i18n.js";
import type { Student } from "../../model.js";
import {
  buildStudentKeyboard,
  deleteMenuMessage,
  getLang,
  studentService,
} from "../helpers.js";
import { attendanceService } from "../../../../bot/services.js";

export async function viewStudentConversation(
  conversation: Conversation<BaseContext, MyContext>,
  ctx: MyContext
) {
  const lang = getLang(ctx);

  await ctx.reply(t("enter_student_name_search", lang));
  let response = await conversation.wait();
  const searchQuery = response.message?.text?.trim();

  if (!searchQuery) {
    await ctx.reply(t("operation_failed", lang));
    return;
  }

  const results = await studentService.search(searchQuery);

  if (results.length === 0) {
    await ctx.reply(t("no_results", lang));
    return;
  }

  const keyboard = buildStudentKeyboard(
    results.map((result) => result.item),
    lang
  );

  await ctx.reply(t("select_student", lang), { reply_markup: keyboard });

  const btnCtx = await conversation.wait();
  const selectedData = btnCtx.callbackQuery?.data;

  if (!selectedData || selectedData === "cancel") {
    await btnCtx.answerCallbackQuery();
    await ctx.reply(t("operation_cancelled", lang));
    return;
  }

  await btnCtx.answerCallbackQuery();
  await deleteMenuMessage(ctx, btnCtx);

  const studentId = parseInt(selectedData.replace("student_", ""));
  const student: Student | null = await studentService.getById(studentId);

  if (!student) {
    await ctx.reply(t("operation_failed", lang));
    return;
  }
  // Prepare base student info
  let message = `
${t("student_info_title", lang)}

${t("student_info_id", lang)}: ${student.id}
${t("student_info_name", lang)}: ${student.firstName} ${student.lastName}
${t("student_info_birth_year", lang)}: ${student.birthYear}
${t("student_info_group", lang)}: ${student.group || t("no_value", lang)}
${t("student_info_phone", lang)}: ${student.phone || t("no_value", lang)}
${t("student_info_father_phone", lang)}: ${student.fatherPhone || t("no_value", lang)}
${t("student_info_mother_phone", lang)}: ${student.motherPhone || t("no_value", lang)}
  `.trim();

  // Attendance summary
  try {
    const attendanceResult = await attendanceService.getStudentAttendance(student.id, {
      limit: 100,
    });
    const records = attendanceResult.records;
    if (records.length > 0) {
      const byEvent: Record<string, Date[]> = {};
      for (const rec of records) {
        const eventName = rec.event;
        if (!eventName) continue;
        if (!byEvent[eventName]) byEvent[eventName] = [];
        byEvent[eventName].push(new Date(rec.createdAt));
      }
      message += `\n\n${t("attendance_summary", lang)}\n\n`;
      const sorted = Object.entries(byEvent).sort(([a], [b]) => a.localeCompare(b));
      for (const [eventName, dates] of sorted) {
        const timeKey =
          dates.length === 1 ? "attendance_times_single" : "attendance_times_multiple";
        message += `**${eventName}**: ${dates.length} ${t(timeKey, lang)}\n`;
        const recentDates = dates
          .slice()
          .sort((a, b) => b.getTime() - a.getTime())
          .slice(0, 5)
          .map((d) => d.toISOString().split("T")[0]);
        message += `${t("recent_label", lang)}: ${recentDates.join(", ")}\n\n`;
      }
    }
  } catch {
    // Ignore attendance fetch errors
  }

  await ctx.reply(message, { parse_mode: "Markdown" });
}

