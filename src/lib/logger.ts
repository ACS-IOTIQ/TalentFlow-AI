import winston from 'winston'
import path from 'path'

const logDir = process.env.LOG_DIR || '/app/logs'

export const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json(),
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple(),
      ),
    }),
    ...(process.env.NODE_ENV === 'production'
      ? [
          new winston.transports.File({ filename: path.join(logDir, 'error.log'), level: 'error' }),
          new winston.transports.File({ filename: path.join(logDir, 'combined.log') }),
        ]
      : []),
  ],
})
