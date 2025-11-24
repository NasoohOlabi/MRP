import { existsSync } from 'fs';
import { mkdir } from 'fs/promises';
import DailyRotateFile from 'winston-daily-rotate-file';
import winston from 'winston';

const logLevel = process.env.LOG_LEVEL || 'info';

// Custom format for JSONL (JSON Lines) - each log entry is a single JSON object
const jsonlFormat = winston.format.combine(
	winston.format.timestamp(),
	winston.format.errors({ stack: true }),
	winston.format.json()
);

// Console format for development (more readable)
const consoleFormat = winston.format.combine(
	winston.format.colorize(),
	winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
	winston.format.printf(({ timestamp, level, message, ...meta }) => {
		let msg = `${timestamp} [${level}]: ${message}`;
		if (Object.keys(meta).length > 0) {
			msg += ` ${JSON.stringify(meta)}`;
		}
		return msg;
	})
);

// Daily rotate file transport for JSONL logs
const dailyRotateFileTransport = new DailyRotateFile({
	filename: 'logs/app-%DATE%.jsonl',
	datePattern: 'YYYY-MM-DD',
	maxFiles: '7d', // Keep logs for 7 days
	format: jsonlFormat,
	level: logLevel,
});

// Create the logger instance
export const logger = winston.createLogger({
	level: logLevel,
	format: jsonlFormat,
	defaultMeta: { service: 'mrp' },
	transports: [
		// Console transport for development
		new winston.transports.Console({
			format: consoleFormat,
			level: logLevel,
		}),
		// Daily rotate file transport for JSONL logs
		dailyRotateFileTransport,
	],
	// Handle exceptions and rejections
	exceptionHandlers: [
		new winston.transports.Console({ format: consoleFormat }),
		new DailyRotateFile({
			filename: 'logs/exceptions-%DATE%.jsonl',
			datePattern: 'YYYY-MM-DD',
			maxFiles: '7d',
			format: jsonlFormat,
		}),
	],
	rejectionHandlers: [
		new winston.transports.Console({ format: consoleFormat }),
		new DailyRotateFile({
			filename: 'logs/rejections-%DATE%.jsonl',
			datePattern: 'YYYY-MM-DD',
			maxFiles: '7d',
			format: jsonlFormat,
		}),
	],
});

// Ensure logs directory exists (winston-daily-rotate-file will create it, but we can be explicit)
if (!existsSync('logs')) {
	mkdir('logs', { recursive: true }).catch((err) => {
		// Use console.error here since logger might not be fully initialized yet
		console.error('Failed to create logs directory:', err);
	});
}

