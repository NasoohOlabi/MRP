import type { Conversation } from "@grammyjs/conversations";
import { attendanceService, teacherService } from "../../../../bot/services.js";
import type { BaseContext, MyContext } from "../../../../types.js";
import { t } from "../../../../utils/i18n.js";
import { paginate } from "../../../../utils/pagination.js";
import type { Student } from "../../model.js";
import {
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

  const students = results.map(r => r.item);

  // Use pagination helper for student selection
  const paginationResult = await paginate(conversation, ctx, {
    items: students,
    header: t("select_student", lang) + "\n",
    renderItem: (student) => {
      return `${student.firstName} ${student.lastName}${student.level ? ` (Level ${student.level})` : ""}`;
    },
    selectable: true,
    getItemId: (student) => `student_${student.id}`,
    lang,
  });

  if (paginationResult.cancelled || !paginationResult.selectedItem) {
    await ctx.reply(t("operation_cancelled", lang));
    return;
  }

  const student: Student = paginationResult.selectedItem;
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
      const total = present.length + absent.length;
      const percentage = total > 0 ? Math.round((present.length / total) * 100) : 0;

      message += `\n\n${t("attendance_summary", lang) || "Attendance Summary"}\n\n`;
      if (present.length > 0) {
        message += `**✅**: ${present.length}\n`;
        const recentDates = present
          .slice()
          .sort()
          .reverse()
          .slice(0, 10);
        message += `${t("recent_label", lang) || "Recent"}: ${recentDates.join(", ")}\n\n`;
      }
      if (absent.length > 0) {
        message += `**❌**: ${absent.length}\n`;
        const recentDates = absent
          .slice()
          .sort()
          .reverse()
          .slice(0, 10);
        message += `${t("recent_label", lang) || "Recent"}: ${recentDates.join(", ")}\n\n`;
      }

      // Add summary at the end
      message += `**${present.length}/${total} ~ ${percentage}%**\n`;
    }
  } catch {
    // Ignore attendance fetch errors
  }

  await ctx.reply(message, { parse_mode: "Markdown" });
}

