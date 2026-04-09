import winston from 'winston';

// Patterns that must never appear in logs
const PII_PATTERNS: RegExp[] = [
  // CLABE: exactly 18 digits (Mexican bank account number)
  /\b\d{18}\b/g,
  // RFC: Mexican tax ID — 12–13 alphanumeric chars starting with letters
  /\b[A-Z&Ñ]{3,4}\d{6}[A-Z0-9]{2,3}\b/gi,
  // Mexican phone numbers
  /\b(\+?52)?[\s\-]?1?[\s\-]?\(?\d{2,3}\)?[\s\-]?\d{3,4}[\s\-]?\d{4}\b/g,
  // Email addresses
  /\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/g,
];

const REDACT = '[REDACTED]';

function redactPII(value: string): string {
  let redacted = value;
  for (const pattern of PII_PATTERNS) {
    redacted = redacted.replace(pattern, REDACT);
  }
  return redacted;
}

function redactObject(obj: unknown): unknown {
  if (typeof obj === 'string') {
    return redactPII(obj);
  }
  if (Array.isArray(obj)) {
    return obj.map(redactObject);
  }
  if (obj !== null && typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(obj as Record<string, unknown>)) {
      // Redact entire value for known sensitive field names
      const lk = key.toLowerCase();
      if (
        lk.includes('clabe') ||
        lk.includes('rfc') ||
        lk.includes('password') ||
        lk.includes('secret') ||
        lk.includes('token') ||
        lk.includes('credit_card') ||
        lk.includes('card_number')
      ) {
        result[key] = REDACT;
      } else {
        result[key] = redactObject(val);
      }
    }
    return result;
  }
  return obj;
}

const piiScrubTransform = winston.format((info) => {
  // Deep-scrub the message string
  if (typeof info.message === 'string') {
    info.message = redactPII(info.message);
  }
  // Scrub any extra metadata keys
  const { level, message, timestamp, stack, ...meta } = info as typeof info & {
    stack?: string;
    timestamp?: string;
  };
  const cleanMeta = redactObject(meta) as Record<string, unknown>;
  return Object.assign(info, cleanMeta);
});

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  format: winston.format.combine(
    piiScrubTransform(),
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    process.env.NODE_ENV === 'production'
      ? winston.format.json()
      : winston.format.combine(
          winston.format.colorize(),
          winston.format.printf(({ timestamp, level, message, ...meta }) => {
            const extra = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
            return `${timestamp} [${level}]: ${message}${extra}`;
          }),
        ),
  ),
  transports: [new winston.transports.Console()],
});

export default logger;
