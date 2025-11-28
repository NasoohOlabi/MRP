import { createConversation } from "@grammyjs/conversations";
import type { Bot } from "grammy";
import type { MyContext } from "../types.js";
import { attendanceConversation } from "../features/attendance/conversations.js";
import { memorizationConversation } from "../features/memorization/conversations.js";
import { studentMenuConversation } from "../features/students/conversations/index.js";
import { teacherMenuConversation } from "../features/teachers/conversations.js";
import {
  assignRoleConversation,
  listUsersConversation,
  registerUserConversation,
  viewProfileConversation,
} from "../features/users/conversations.js";

export function registerConversations(bot: Bot<MyContext>): void {
  bot.use(createConversation(studentMenuConversation, "students"));
  bot.use(createConversation(teacherMenuConversation, "teachers"));
  bot.use(createConversation(attendanceConversation, "attendance"));
  bot.use(createConversation(memorizationConversation, "memorization"));
  bot.use(createConversation(registerUserConversation, "register_user"));
  bot.use(createConversation(viewProfileConversation, "view_profile"));
  bot.use(createConversation(assignRoleConversation, "assign_role"));
  bot.use(createConversation(listUsersConversation, "list_users"));
}




