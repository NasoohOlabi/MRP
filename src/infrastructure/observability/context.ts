// Async context for request-scoped metadata
import { AsyncLocalStorage } from 'async_hooks';

export interface RequestContext {
	userId?: number;
	chatId?: number;
	traceId?: string;
	spanId?: string;
	[key: string]: unknown;
}

const contextStorage = new AsyncLocalStorage<RequestContext>();

export function getContext(): RequestContext {
	return contextStorage.getStore() ?? {};
}

export function setContext(context: RequestContext): void {
	contextStorage.enterWith(context);
}

export function runWithContext<T>(context: RequestContext, fn: () => T): T {
	return contextStorage.run(context, fn);
}

export function runWithContextAsync<T>(context: RequestContext, fn: () => Promise<T>): Promise<T> {
	return contextStorage.run(context, fn);
}

