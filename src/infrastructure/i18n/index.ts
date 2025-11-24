// Internationalization utilities
import { ar } from './locales/ar.js';
import { en } from './locales/en.js';

const locales = { en, ar };

export type LocaleKey = keyof typeof en;
export type Language = 'en' | 'ar';

export function t(key: string, lang: Language = 'en', params?: Record<string, string>): string {
	const locale = locales[lang] || en;
	// @ts-expect-error - Dynamic key access
	let text: string = locale[key] || key;
	if (params) {
		for (const [k, v] of Object.entries(params)) {
			text = text.replace(`{${k}}`, v);
		}
	}
	return text;
}

export function getLang(session: { language?: Language }): Language {
	return session?.language || 'en';
}

