import type {
	ConversationFlavor,
} from '@grammyjs/conversations';
import type { SessionFlavor } from 'grammy';
import { Context } from 'grammy';

export type MySession = { state?: string };
export type BaseContext = Context & SessionFlavor<MySession>;
export type MyContext = BaseContext & ConversationFlavor<BaseContext>;

export type BaseStep = {
	prompt: string;
};

export type TextStep = BaseStep & {
	type: 'text';
	validate: (text: string | undefined) => boolean;
	error: string;
	next: ((value: string) => Promise<Step | null>) | ((value: string) => Step | null);
};

export type ButtonStep = BaseStep & {
	type: 'button';
	options: {
		text: string;
		data: string;
		url?: string;
		next: Step | null;
	}[];
	onSelect?: (data: string, ctx: MyContext, btnResponse: MyContext) => Promise<void>;
};

export type Step = TextStep | ButtonStep;

export type TreeConversationOptions<T> = {
	entry: Step;
	onSuccess: (results: Record<string, string>) => Promise<T>;
	successMessage: string;
	failureMessage: string;
};