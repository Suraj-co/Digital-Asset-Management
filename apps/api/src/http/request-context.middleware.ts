import type { NextFunction, Request, Response } from 'express';
import { writeLog } from '../logging/json-logger.js';
import {
  requestContext,
  resolveCorrelationId,
  type RequestWithCorrelation,
} from './request-context.js';

export function requestPath(
  req: Pick<Request, 'originalUrl' | 'url' | 'path'>,
): string {
  const raw = req.originalUrl || req.url || req.path || '/';
  const path = raw.split('?')[0];
  return path || '/';
}

export function requestContextMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const correlationId = resolveCorrelationId(req.header('x-request-id'));
  (req as RequestWithCorrelation).correlationId = correlationId;
  res.setHeader('x-request-id', correlationId);
  const started = process.hrtime.bigint();

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - started) / 1_000_000;
    writeLog('info', 'request.completed', {
      context: 'HTTP',
      correlationId,
      method: req.method,
      path: requestPath(req),
      statusCode: res.statusCode,
      durationMs: Math.round(durationMs * 10) / 10,
    });
  });

  requestContext.run({ correlationId }, () => {
    next();
  });
}
