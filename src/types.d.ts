import type {
	ConversationFlavor,
} from '@grammyjs/conversations';
import type { SessionFlavor } from 'grammy';
import { Context } from 'grammy';

export type MySession = { state?: string };
export type BaseContext = Context & SessionFlavor<MySession>;
export type MyContext = BaseContext & ConversationFlavor<BaseContext>;
