import type { MyContext } from "../types.js";

export function getLang(ctx: MyContext): string {
  return ctx.session?.language || "ar";
}

export function formatDate(date: Date, lang: string): string {
  return lang === "ar" ? date.toLocaleDateString("ar-SA") : date.toLocaleDateString("en-US");
}

