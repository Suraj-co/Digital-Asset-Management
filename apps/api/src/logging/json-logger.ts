import type { LoggerService, LogLevel } from '@nestjs/common';
import { requestContext } from '../http/request-context.js';
import { redact } from './redact.js';

type LogFields = Record<string, unknown>;

const LEVELS: Record<string, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function threshold(): number {
  const configured = process.env.LOG_LEVEL ?? 'info';
  return LEVELS[configured] ?? LEVELS.info;
}

export function writeLog(
  level: 'debug' | 'info' | 'warn' | 'error',
  message: string,
  fields: LogFields = {},
): void {
  if ((LEVELS[level] ?? LEVELS.info) < threshold()) {
    return;
  }

  const correlationId = requestContext.getStore()?.correlationId;
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...(correlationId ? { correlationId } : {}),
    ...fields,
  };
  const line = redact(JSON.stringify(entry));
  const stream = level === 'error' ? process.stderr : process.stdout;
  stream.write(`${line}\n`);
}

function textOf(message: unknown): string {
  if (typeof message === 'string') {
    return message;
  }
  if (message instanceof Error) {
    return message.message;
  }
  try {
    return JSON.stringify(message);
  } catch {
    return '[unserializable]';
  }
}

export class JsonLogger implements LoggerService {
  constructor(private readonly context?: string) {}

  log(message: unknown, context?: string): void {
    this.write('info', message, context);
  }

  error(message: unknown, stack?: string, context?: string): void {
    this.write('error', message, context, stack);
  }

  warn(message: unknown, context?: string): void {
    this.write('warn', message, context);
  }

  debug(message: unknown, context?: string): void {
    this.write('debug', message, context);
  }

  verbose(message: unknown, context?: string): void {
    this.write('debug', message, context);
  }

  fatal(message: unknown, context?: string): void {
    this.write('error', message, context);
  }

  setLogLevels(_levels: LogLevel[]): void {
    // Level selection is controlled by LOG_LEVEL.
  }

  private write(
    level: 'debug' | 'info' | 'warn' | 'error',
    message: unknown,
    context?: string,
    stack?: string,
  ): void {
    writeLog(level, textOf(message), {
      context: context ?? this.context,
      ...(stack ? { stack: redact(stack) } : {}),
    });
  }
}
