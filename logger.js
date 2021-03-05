let winston = require('winston');
require('winston-daily-rotate-file');

const { createLogger, format, transports } = require('winston');

const { combine, timestamp, label, printf } = format;

const myFormat = printf(({ level, message, label, timestamp }) => {
  return `${timestamp} [${label}] ${level}: ${message}`;
});

let logger = winston.createLogger({
  level: 'debug',
  format: combine(label({ label: 'main' }), timestamp(), myFormat),
  defaultMeta: { service: 'user-service' },
  transports: [
    new winston.transports.DailyRotateFile({
      filename: './logs/service-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '14d',
    }),
  ],
});

winston.loggers.add('risco', {
  level: 'debug',
  format: combine(label({ label: 'risco' }), timestamp(), myFormat),
  transports: [
    new winston.transports.DailyRotateFile({
      filename: './logs/risco-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '14d',
    }),
  ],
});

module.exports = logger;
