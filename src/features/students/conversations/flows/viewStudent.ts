import type { Conversation } from "@grammyjs/conversations";
import { attendanceService, memorizationService } from "../../../../bot/services.js";
import type { BaseContext, MyContext } from "../../../../types.js";
import { t } from "../../../../utils/i18n.js";
import type { Student } from "../../model.js";
import {
  buildStudentKeyboard,
  deleteMenuMessage,
  getLang,
  studentService,
} from "../helpers.js";

export async function viewStudentConversation(
  conversation: Conversation<BaseContext, MyContext>,
  ctx: MyContext
) {
  const lang = getLang(ctx);

  await ctx.reply("Enter the student name to search:");
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
**Student Information**

ID: ${student.id}
Name: ${student.firstName} ${student.lastName}
Birth Year: ${student.birthYear}
Group: ${student.group || "N/A"}
Phone: ${student.phone || "N/A"}
Father's Phone: ${student.fatherPhone || "N/A"}
Mother's Phone: ${student.motherPhone || "N/A"}
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
      message += `\n\n**Attendance**\n\n`;
      const sorted = Object.entries(byEvent).sort(([a], [b]) => a.localeCompare(b));
      for (const [eventName, dates] of sorted) {
        message += `**${eventName}**: ${dates.length} ${dates.length === 1 ? "time" : "times"}\n`;
        const recentDates = dates
          .slice()
          .sort((a, b) => b.getTime() - a.getTime())
          .slice(0, 5)
          .map((d) => d.toISOString().split("T")[0]);
        message += `Recent: ${recentDates.join(", ")}\n\n`;
      }
    }
  } catch {
    // Ignore attendance fetch errors
  }

  // Memorization summary
  try {
    const memorizationResult = await memorizationService.getStudentMemorizations(student.id, {
      limit: 100,
    });
    const totalMemorization = memorizationResult.total;
    const memorizationRecords = memorizationResult.records;
    if (memorizationRecords.length > 0 || totalMemorization > 0) {
      message += `\n**Memorization Records**\n\nTotal: ${totalMemorization}\n\n`;
      const recentMemorizations = memorizationRecords
        .slice(0, 20)
        .map((m) => `Page ${m.page} - ${new Date(m.createdAt).toLocaleDateString(lang === "ar" ? "ar-SA" : "en-US")}`)
        .join("\n");
      if (recentMemorizations) {
        message += recentMemorizations + "\n";
      }
      if (totalMemorization > 20) {
        message += `\n... and ${totalMemorization - 20} more records\n`;
      }
    }
  } catch {
    // Ignore memorization fetch errors
  }

  await ctx.reply(message, { parse_mode: "Markdown" });
}

