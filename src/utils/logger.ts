import { existsSync } from 'fs';
import { mkdir } from 'fs/promises';
import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

const logLevel = process.env['LOG_LEVEL'] || 'info';

// Format that adds logType metadata to distinguish log sources
const addLogTypeFormat = (logType: string) => winston.format((info) => {
	info['logType'] = logType;
	return info;
})();

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
	winston.format.printf(({ timestamp, level, message, logType, ...meta }) => {
		const typeTag = logType ? `[${logType}] ` : '';
		let msg = `${timestamp} [${level}]: ${typeTag}${message}`;
		if (Object.keys(meta).length > 0) {
			msg += ` ${JSON.stringify(meta)}`;
		}
		return msg;
	})
);

// Helper function to create a DailyRotateFile transport with immediate writes
function createImmediateWriteTransport(config: {
	filename: string;
	datePattern: string;
	maxFiles: string;
	format: winston.Logform.Format;
	level?: string;
}) {
	const transport = new DailyRotateFile({
		...config,
		level: config.level || logLevel,
		options: {
			highWaterMark: 1, // Minimal buffer - write after 1 byte
			flags: 'a', // Append mode
		},
	});

	// Override the log method to ensure immediate flush
	if (transport.log) {
		const originalLog = transport.log.bind(transport);
		transport.log = function (info: any, callback: () => void) {
			originalLog(info, () => {
				// Access the underlying stream and force flush if possible
				const stream = (transport as any).stream;
				if (stream) {
					// Try to flush the stream
					if (typeof stream.flush === 'function') {
						stream.flush();
					} else if (stream._writableState && stream._writableState.buffer.length > 0) {
						// Force the stream to process buffered data
						stream.emit('drain');
					}
				}
				callback();
			});
			return transport;
		};
	}

	return transport;
}

// Single daily rotate file transport for all logs with immediate writes
const dailyRotateFileTransport = createImmediateWriteTransport({
	filename: 'logs/app-%DATE%.jsonl',
	datePattern: 'YYYY-MM-DD',
	maxFiles: '7d', // Keep logs for 7 days
	format: winston.format.combine(
		addLogTypeFormat('app'),
		jsonlFormat
	),
});

// Create the logger instance
export const logger = winston.createLogger({
	level: logLevel,
	format: winston.format.combine(
		addLogTypeFormat('app'),
		jsonlFormat
	),
	defaultMeta: { service: 'mrp' },
	transports: [
		// Console transport for development
		new winston.transports.Console({
			format: consoleFormat,
			level: logLevel,
		}),
		// Single daily rotate file transport for all logs (with immediate writes)
		dailyRotateFileTransport,
	],
	// Handle exceptions and rejections - use same file but tag them
	exceptionHandlers: [
		new winston.transports.Console({
			format: winston.format.combine(
				addLogTypeFormat('exception'),
				consoleFormat
			)
		}),
		createImmediateWriteTransport({
			filename: 'logs/app-%DATE%.jsonl',
			datePattern: 'YYYY-MM-DD',
			maxFiles: '7d',
			format: winston.format.combine(
				addLogTypeFormat('exception'),
				jsonlFormat
			),
		}),
	],
	rejectionHandlers: [
		new winston.transports.Console({
			format: winston.format.combine(
				addLogTypeFormat('rejection'),
				consoleFormat
			)
		}),
		createImmediateWriteTransport({
			filename: 'logs/app-%DATE%.jsonl',
			datePattern: 'YYYY-MM-DD',
			maxFiles: '7d',
			format: winston.format.combine(
				addLogTypeFormat('rejection'),
				jsonlFormat
			),
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

