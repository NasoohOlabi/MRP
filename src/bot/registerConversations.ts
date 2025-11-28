import { createConversation } from "@grammyjs/conversations";
import type { Bot } from "grammy";
import { attendanceConversation } from "../features/attendance/conversations.js";
import { studentMenuConversation } from "../features/students/conversations/menu.js";
import { teacherMenuConversation } from "../features/teachers/conversations.js";
import {
  assignRoleConversation,
  listUsersConversation,
  registerUserConversation,
  viewProfileConversation,
} from "../features/users/conversations.js";
import type { MyContext } from "../types.js";

export function registerConversations(bot: Bot<MyContext>): void {
  bot.use(createConversation(studentMenuConversation, "students"));
  bot.use(createConversation(teacherMenuConversation, "teachers"));
  bot.use(createConversation(attendanceConversation, "attendance"));
  bot.use(createConversation(registerUserConversation, "register_user"));
  bot.use(createConversation(viewProfileConversation, "view_profile"));
  bot.use(createConversation(assignRoleConversation, "assign_role"));
  bot.use(createConversation(listUsersConversation, "list_users"));
}




