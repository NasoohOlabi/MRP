import type { MyContext } from "../types";

export const greetingText = "Welcome! Please use one of the following commands:\n• /student – to interact with student records\n• /teacher – to interact with teacher records\n• /browse – to browse records";

export async function sendGreeting(ctx: MyContext) {
  await ctx.reply(greetingText);
  ctx.session.state = "START";
}

export async function deleteCallbackMessage(btnCtx?: MyContext) {
  const m = btnCtx?.callbackQuery?.message;
  if (!m) return;
  await btnCtx!.api.deleteMessage(m.chat.id, m.message_id);
}

export async function cancelAndGreet(ctx: MyContext, btnCtx?: MyContext) {
  try {
    await deleteCallbackMessage(btnCtx);
  } catch {}
  await sendGreeting(ctx);
}