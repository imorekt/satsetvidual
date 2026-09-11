import winston from 'winston';
import fs from 'fs';
import path from 'path';

// Ensure logs directory exists
const logsDir = path.resolve(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const customFormat = winston.format.printf(({ level, message, timestamp, ...metadata }) => {
  let metaStr = '';
  if (Object.keys(metadata).length > 0) {
    metaStr = ` ${JSON.stringify(metadata)}`;
  }
  return `[${timestamp}] [${level.toUpperCase().padEnd(5)}] ${message}${metaStr}`;
});

import { EventEmitter } from 'events';

export const logEmitter = new EventEmitter();
logEmitter.setMaxListeners(50);

const liveStreamFormat = winston.format((info) => {
  setImmediate(() => {
    logEmitter.emit('log', {
      timestamp: info.timestamp || new Date().toISOString(),
      level: info.level,
      message: info.message,
    });
  });
  return info;
});

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
    winston.format.splat(),
    liveStreamFormat(),
    customFormat
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize({ all: true }),
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
        customFormat
      ),
    }),
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
    }),
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
    }),
    new winston.transports.File({
      filename: path.join(logsDir, 'trades.log'),
      level: 'info',
    }),
  ],
});

