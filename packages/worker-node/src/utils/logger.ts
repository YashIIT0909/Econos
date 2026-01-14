import winston from 'winston';

const { combine, timestamp, printf, colorize } = winston.format;

/**
 * Custom log format
 */
const logFormat = printf(({ level, message, timestamp, ...metadata }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(metadata).length > 0) {
        msg += ` ${JSON.stringify(metadata)}`;
    }
    return msg;
});

/**
 * Logger instance for the worker node
 */
export const logger = winston.createLogger({
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    format: combine(
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        logFormat
    ),
    transports: [
        new winston.transports.Console({
            format: combine(
                colorize(),
                timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
                logFormat
            ),
        }),
    ],
});

/**
 * Log service request
 */
export function logServiceRequest(
    serviceName: string,
    requestId: string,
    action: 'start' | 'complete' | 'error',
    details?: Record<string, unknown>
): void {
    const message = `Service ${action}: ${serviceName}`;
    const meta = { requestId, ...details };

    switch (action) {
        case 'start':
            logger.info(message, meta);
            break;
        case 'complete':
            logger.info(message, meta);
            break;
        case 'error':
            logger.error(message, meta);
            break;
    }
}
