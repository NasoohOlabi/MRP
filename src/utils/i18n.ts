import { en } from '../locales/en';
import { ar } from '../locales/ar';
import type { MySession } from '../types';

const locales = { en, ar };

export type LocaleKey = keyof typeof en;

export function t(key: string, lang: string = 'en', params?: Record<string, string>): string {
    const locale = locales[lang as keyof typeof locales] || en;
    // @ts-ignore
    let text = locale[key] || key;
    if (params) {
        for (const [k, v] of Object.entries(params)) {
            text = text.replace(`{${k}}`, v);
        }
    }
    return text;
}

export function getLang(session: MySession): string {
    // @ts-ignore
    return session?.language || 'en';
}
