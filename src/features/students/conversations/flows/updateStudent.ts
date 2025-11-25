import { InlineKeyboard } from "grammy";
import type { Conversation } from "@grammyjs/conversations";
import type { BaseContext, MyContext } from "../../../../types.js";
import { t } from "../../../../utils/i18n.js";
import { Student } from "../model.js";
import {
  buildStudentKeyboard,
  deleteMenuMessage,
  getLang,
  studentService,
} from "../helpers.js";

export async function updateStudentConversation(
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
  let student: Student | null = await studentService.getById(studentId);

  if (!student) {
    await ctx.reply(t("operation_failed", lang));
    return;
  }

  const updates: Partial<Student> = {};

  while (true) {
    const currentInfo = `
**Current Student Information:**
Name: ${student.firstName} ${student.lastName}
Group: ${student.group || "None"}
Phone: ${student.phone || "None"}
Father's Phone: ${student.fatherPhone || "None"}
Mother's Phone: ${student.motherPhone || "None"}

Select a field to update:
    `.trim();

    const fieldKeyboard = new InlineKeyboard()
      .text("First Name", "field_firstName")
      .row()
      .text("Last Name", "field_lastName")
      .row()
      .text("Group", "field_group")
      .row()
      .text("Phone", "field_phone")
      .row()
      .text("Father's Phone", "field_fatherPhone")
      .row()
      .text("Mother's Phone", "field_motherPhone")
      .row()
      .text("Finish & Save", "field_finish")
      .row()
      .text(t("cancel", lang), "field_cancel");

    await ctx.reply(currentInfo, { parse_mode: "Markdown", reply_markup: fieldKeyboard });

    const fieldCtx = await conversation.wait();
    const fieldAction = fieldCtx.callbackQuery?.data;

    if (!fieldAction) {
      await ctx.reply(t("operation_failed", lang));
      return;
    }

    await fieldCtx.answerCallbackQuery();
    await deleteMenuMessage(ctx, fieldCtx);

    if (fieldAction === "field_cancel") {
      await ctx.reply(t("operation_cancelled", lang));
      return;
    }

    if (fieldAction === "field_finish") {
      await ctx.reply(t("processing", lang));
      try {
        await studentService.update({ ...student, ...updates });
        await ctx.reply(t("operation_completed", lang));
        return;
      } catch (err) {
        await ctx.reply(t("operation_failed", lang));
        return;
      }
    }

    response = await handleFieldAction(fieldAction, conversation, ctx, student, updates, lang);
    if (!response) {
      continue;
    }
    student = response;
  }
}

async function handleFieldAction(
  action: string,
  conversation: Conversation<BaseContext, MyContext>,
  ctx: MyContext,
  student: Student,
  updates: Partial<Student>,
  lang: string
): Promise<Student | null> {
  let response = await conversation.wait();
  const newValue = response.message?.text?.trim();

  if (action === "field_firstName" && newValue) {
    updates.firstName = newValue;
    return { ...student, firstName: newValue };
  }

  if (action === "field_lastName" && newValue) {
    updates.lastName = newValue;
    return { ...student, lastName: newValue };
  }

  if (action === "field_group") {
    const groups = await studentService.getAllGroups();
    const groupKeyboard = new InlineKeyboard();

    if (groups.length > 0) {
      for (const group of groups.slice(0, 10)) {
        const callbackData = `group_${group}`;
        if (callbackData.length <= 64) {
          groupKeyboard.text(group, callbackData).row();
        }
      }
    }

    if (student.group) {
      groupKeyboard.text("Remove Group", "group_remove").row();
    }
    groupKeyboard.text(t("cancel", lang), "group_cancel");

    const groupMessage = groups.length === 0
      ? `No groups available. Current group: ${student.group || "None"}`
      : `Select a group (current: ${student.group || "None"}):`;

    await ctx.reply(groupMessage, { reply_markup: groupKeyboard });
    const groupCtx = await conversation.wait();
    const groupAction = groupCtx.callbackQuery?.data;

    await groupCtx.answerCallbackQuery();
    await deleteMenuMessage(ctx, groupCtx);

    if (groupAction && groupAction.startsWith("group_")) {
      if (groupAction === "group_remove") {
        updates.group = null;
        return { ...student, group: null };
      } else if (groupAction !== "group_cancel") {
        const selectedGroup = groupAction.substring(6);
        updates.group = selectedGroup;
        return { ...student, group: selectedGroup };
      }
    }
    return student;
  }

  if (action === "field_phone" && newValue) {
    if (newValue === "-") {
      updates.phone = null;
      return { ...student, phone: null };
    }
    updates.phone = newValue;
    return { ...student, phone: newValue };
  }

  if (action === "field_fatherPhone" && newValue) {
    if (newValue === "-") {
      updates.fatherPhone = null;
      return { ...student, fatherPhone: null };
    }
    updates.fatherPhone = newValue;
    return { ...student, fatherPhone: newValue };
  }

  if (action === "field_motherPhone" && newValue) {
    if (newValue === "-") {
      updates.motherPhone = null;
      return { ...student, motherPhone: null };
    }
    updates.motherPhone = newValue;
    return { ...student, motherPhone: newValue };
  }

  return null;
}

