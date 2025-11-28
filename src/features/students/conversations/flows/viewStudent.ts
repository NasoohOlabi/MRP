import type { Conversation } from "@grammyjs/conversations";
import { attendanceService, teacherService } from "../../../../bot/services.js";
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
  // Get teacher name for display
  const teacher = await teacherService.getById(student.teacherId);
  const teacherName = teacher ? ((teacher as any).name || `${(teacher as any).firstName || ''} ${(teacher as any).lastName || ''}`.trim() || `Teacher ${teacher.id}`) : `ID: ${student.teacherId}`;

  // Prepare base student info
  let message = `
${t("student_info_title", lang)}

${t("student_info_id", lang)}: ${student.id}
${t("student_info_name", lang)}: ${student.firstName} ${student.lastName}
${t("student_info_birth_year", lang)}: ${student.birthYear || t("no_value", lang)}
${t("student_info_level", lang) || "Level"}: ${student.level || t("no_value", lang)}
${t("student_info_phone", lang)}: ${student.phone || t("no_value", lang)}
${t("student_info_teacher", lang) || "Teacher"}: ${teacherName}
  `.trim();

  // Attendance summary
  try {
    const attendanceResult = await attendanceService.getStudentAttendance(student.id, {
      limit: 100,
    });
    const records = attendanceResult.records;
    if (records.length > 0) {
      const present: string[] = [];
      const absent: string[] = [];
      for (const rec of records) {
        if (rec.status === 'present') {
          present.push(rec.date);
        } else {
          absent.push(rec.date);
        }
      }
      message += `\n\n${t("attendance_summary", lang) || "Attendance Summary"}\n\n`;
      if (present.length > 0) {
        message += `**${t("present", lang) || "Present"}**: ${present.length}\n`;
        const recentDates = present
          .slice()
          .sort()
          .reverse()
          .slice(0, 10);
        message += `${t("recent_label", lang) || "Recent"}: ${recentDates.join(", ")}\n\n`;
      }
      if (absent.length > 0) {
        message += `**${t("absent", lang) || "Absent"}**: ${absent.length}\n`;
        const recentDates = absent
          .slice()
          .sort()
          .reverse()
          .slice(0, 10);
        message += `${t("recent_label", lang) || "Recent"}: ${recentDates.join(", ")}\n\n`;
      }
    }
  } catch {
    // Ignore attendance fetch errors
  }

  await ctx.reply(message, { parse_mode: "Markdown" });
}

