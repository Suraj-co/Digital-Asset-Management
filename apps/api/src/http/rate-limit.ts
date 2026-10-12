import type { NextFunction, Request, Response } from 'express';
import { writeLog } from '../logging/json-logger.js';
import { requestPath } from './request-context.middleware.js';
import { resolveCorrelationId } from './request-context.js';

const MAX_TRACKED_CLIENTS = 1000;

export type RateLimitDecision = {
  allowed: boolean;
  retryAfterSeconds: number;
  firstRefusal: boolean;
};

type Bucket = {
  windowStarted: number;
  count: number;
  loggedRefusal: boolean;
};

export class RequestRateLimiter {
  private readonly buckets = new Map<string, Bucket>();

  constructor(
    private readonly max: number,
    private readonly windowMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  take(key: string): RateLimitDecision {
    const now = this.now();
    this.prune(now);
    const current = this.buckets.get(key);
    if (!current || now - current.windowStarted >= this.windowMs) {
      this.buckets.set(key, { windowStarted: now, count: 1, loggedRefusal: false });
      return { allowed: true, retryAfterSeconds: 0, firstRefusal: false };
    }
    if (current.count >= this.max) {
      const firstRefusal = !current.loggedRefusal;
      current.loggedRefusal = true;
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((current.windowStarted + this.windowMs - now) / 1000),
      );
      return { allowed: false, retryAfterSeconds, firstRefusal };
    }
    current.count += 1;
    return { allowed: true, retryAfterSeconds: 0, firstRefusal: false };
  }

  private prune(now: number): void {
    if (this.buckets.size < MAX_TRACKED_CLIENTS) {
      return;
    }
    for (const [key, bucket] of this.buckets) {
      if (now - bucket.windowStarted >= this.windowMs) {
        this.buckets.delete(key);
      }
    }
    while (this.buckets.size >= MAX_TRACKED_CLIENTS) {
      const oldest = this.buckets.keys().next().value;
      if (oldest === undefined) {
        return;
      }
      this.buckets.delete(oldest);
    }
  }
}

export function clientAddress(req: Pick<Request, 'socket'>): string {
  const address = req.socket?.remoteAddress;
  if (!address) {
    return 'unknown';
  }
  return address;
}

export function rateLimitMiddleware(limiter: RequestRateLimiter) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const decision = limiter.take(clientAddress(req));
    if (decision.allowed) {
      next();
      return;
    }
    const correlationId = resolveCorrelationId(req.header('x-request-id'));
    if (decision.firstRefusal) {
      writeLog('warn', 'rate_limit.refused', {
        context: 'RateLimit',
        correlationId,
        path: requestPath(req),
        retryAfterSeconds: decision.retryAfterSeconds,
      });
    }
    res.setHeader('Retry-After', String(decision.retryAfterSeconds));
    res.setHeader('X-Request-Id', correlationId);
    res.status(429).json({
      statusCode: 429,
      error: 'too_many_requests',
      message: 'Too many requests from this client. Try again later.',
      correlationId,
      timestamp: new Date().toISOString(),
      path: requestPath(req),
    });
  };
}
