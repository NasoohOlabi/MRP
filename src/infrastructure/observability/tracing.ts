// OpenTelemetry tracing
import { SpanStatusCode, trace } from '@opentelemetry/api';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { getContext } from './context.js';
import { logger } from './logger.js';

let sdk: NodeSDK | null = null;

export function initializeTracing(): void {
	if (sdk) {
		return; // Already initialized
	}

	try {
		sdk = new NodeSDK({
			resource: resourceFromAttributes({
				[SemanticResourceAttributes.SERVICE_NAME]: 'mrp',
				[SemanticResourceAttributes.SERVICE_VERSION]: '1.0.0',
			}),
			instrumentations: [getNodeAutoInstrumentations()],
		});

		sdk.start();
		logger.info('Tracing initialized');
	} catch (error) {
		logger.error('Failed to initialize tracing', { error });
	}
}

export function shutdownTracing(): Promise<void> {
	if (!sdk) {
		return Promise.resolve();
	}
	return sdk.shutdown();
}

// Helper to create a span
export async function withSpan<T>(
	name: string,
	fn: (span: ReturnType<typeof trace.getActiveSpan>) => Promise<T>,
	attributes?: Record<string, string | number | boolean>,
): Promise<T> {
	const tracer = trace.getTracer('mrp');
	return tracer.startActiveSpan(name, attributes ? { attributes } : {}, async (span) => {
		try {
			const ctx = getContext();
			if (ctx.traceId) {
				span.setAttribute('trace.id', ctx.traceId);
			}
			if (ctx.userId) {
				span.setAttribute('user.id', ctx.userId);
			}
			if (ctx.chatId) {
				span.setAttribute('chat.id', ctx.chatId);
			}
			const result = await fn(span);
			span.setStatus({ code: SpanStatusCode.OK });
			return result;
		} catch (error) {
			span.setStatus({
				code: SpanStatusCode.ERROR,
				message: error instanceof Error ? error.message : String(error),
			});
			if (error instanceof Error) {
				span.recordException(error);
			}
			throw error;
		} finally {
			span.end();
		}
	});
}

// Generate trace ID
export function generateTraceId(): string {
	return trace.getActiveSpan()?.spanContext().traceId || `trace-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

