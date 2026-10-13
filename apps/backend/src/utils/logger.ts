import pino, { LoggerOptions } from 'pino';

/**
 * Structured JSON logger (pino). In production every line is one JSON object
 * (level, time, msg, requestId/jobId/deploymentId, err with stack) that log
 * tools can search and filter. In development it is pretty-printed.
 *
 * LOG_LEVEL: trace | debug | info (default) | warn | error | silent
 */
const isProduction = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test';

function devTransport(): LoggerOptions['transport'] {
  if (isProduction || process.env.LOG_PRETTY === 'false') return undefined;
  try {
    require.resolve('pino-pretty'); // devDependency — absent in the production image
    return { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname,service' } };
  } catch {
    return undefined;
  }
}

export const logger = pino({
  level: process.env.LOG_LEVEL || (isTest ? 'silent' : 'info'),
  base: { service: process.env.SERVICE_NAME || 'devlens-backend' },
  timestamp: pino.stdTimeFunctions.isoTime,
  // Never write credentials to the logs
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.headers["x-devlens-signature-256"]',
      'res.headers["set-cookie"]',
    ],
    censor: '[redacted]',
  },
  serializers: { err: pino.stdSerializers.err },
  transport: devTransport(),
});

export default logger;

/**
 * The request-scoped logger (carries the request id) set by pino-http, or the
 * base logger when a handler runs without it (unit tests, background code).
 */
export function reqLogger(req: { log?: pino.Logger }): pino.Logger {
  return req.log ?? logger;
}
