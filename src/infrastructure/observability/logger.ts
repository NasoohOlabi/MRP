// Structured logging with Pino
import { existsSync } from 'fs';
import { mkdir } from 'fs/promises';
import pino from 'pino';
import { getContext } from './context.js';

const logLevel = process.env['LOG_LEVEL'] || 'info';
const isDevelopment = process.env['NODE_ENV'] !== 'production';

// Create logs directory if it doesn't exist
if (!existsSync('logs')) {
	mkdir('logs', { recursive: true }).catch((err) => {
		console.error('Failed to create logs directory:', err);
	});
}

// Get current date for filename
const getLogFileName = () => {
	const today = new Date().toISOString().split('T')[0];
	return `logs/app-${today}.jsonl`;
};

// Create file destination with sync writes for immediate flushing
// Using sync: true ensures logs are written immediately to disk
const fileDestination = pino.destination({
	dest: getLogFileName(),
	sync: true, // Sync writes - ensures immediate flush to disk
});

// Ensure file destination handles errors
fileDestination.on('error', (err) => {
	console.error('Log file destination error:', err);
});

// Create streams array
const streams: pino.Stream[] = [
	// File stream - always active
	{
		level: logLevel,
		stream: fileDestination,
	},
];

// Add console stream
if (isDevelopment) {
	streams.push({
		level: logLevel,
		stream: pino.transport({
			target: 'pino-pretty',
			options: {
				colorize: true,
				translateTime: 'HH:MM:ss.l',
				ignore: 'pid,hostname',
			},
		}),
	});
} else {
	streams.push({
		level: logLevel,
		stream: process.stdout,
	});
}

// Base logger with multi-stream
const baseLogger = pino(
	{
		level: logLevel,
		base: {
			service: 'mrp',
		},
	},
	pino.multistream(streams),
);

// Logger with context injection
// Note: Using sync: true ensures logs are written immediately to disk
export const logger = {
	debug: (msg: string, meta?: Record<string, unknown>) => {
		const context = getContext();
		baseLogger.debug({ ...context, ...meta }, msg);
	},
	info: (msg: string, meta?: Record<string, unknown>) => {
		const context = getContext();
		baseLogger.info({ ...context, ...meta }, msg);
	},
	warn: (msg: string, meta?: Record<string, unknown>) => {
		const context = getContext();
		baseLogger.warn({ ...context, ...meta }, msg);
	},
	error: (msg: string, meta?: Record<string, unknown>) => {
		const context = getContext();
		baseLogger.error({ ...context, ...meta }, msg);
	},
	fatal: (msg: string, meta?: Record<string, unknown>) => {
		const context = getContext();
		baseLogger.fatal({ ...context, ...meta }, msg);
	},
	child: (bindings: Record<string, unknown>) => {
		return baseLogger.child(bindings);
	},
};

