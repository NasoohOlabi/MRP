// Middleware to inject request context for observability
import type { MiddlewareFn } from 'grammy';
import type { MyContext } from '../../../types.js';
import { generateTraceId, runWithContextAsync } from '../../../infrastructure/observability/index.js';

export const contextMiddleware: MiddlewareFn<MyContext> = async (ctx, next) => {
	const userId = ctx.from?.id;
	const chatId = ctx.chat?.id;
	const traceId = generateTraceId();

	const context = {
		userId,
		chatId,
		traceId,
	};

	return runWithContextAsync(context, async () => {
		return next();
	});
};

