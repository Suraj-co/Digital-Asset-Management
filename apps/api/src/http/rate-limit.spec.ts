import type { NextFunction, Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { rateLimitMiddleware, RequestRateLimiter } from './rate-limit.js';

describe('RequestRateLimiter', () => {
  it('allows the max and refuses the next call in the same window', () => {
    let now = 1_000;
    const limiter = new RequestRateLimiter(2, 60_000, () => now);
    expect(limiter.take('127.0.0.1').allowed).toBe(true);
    expect(limiter.take('127.0.0.1').allowed).toBe(true);
    const refused = limiter.take('127.0.0.1');
    expect(refused.allowed).toBe(false);
    expect(refused.firstRefusal).toBe(true);
    expect(refused.retryAfterSeconds).toBe(60);
    expect(limiter.take('127.0.0.1').firstRefusal).toBe(false);
  });

  it('counts a different address on its own', () => {
    const limiter = new RequestRateLimiter(1, 60_000, () => 0);
    expect(limiter.take('10.0.0.1').allowed).toBe(true);
    expect(limiter.take('10.0.0.1').allowed).toBe(false);
    expect(limiter.take('10.0.0.2').allowed).toBe(true);
  });

  it('starts a new window after the current one ends', () => {
    let now = 0;
    const limiter = new RequestRateLimiter(1, 1_000, () => now);
    expect(limiter.take('127.0.0.1').allowed).toBe(true);
    expect(limiter.take('127.0.0.1').allowed).toBe(false);
    now = 1_000;
    expect(limiter.take('127.0.0.1').allowed).toBe(true);
  });

  it('drops the oldest address once 1000 are tracked', () => {
    const limiter = new RequestRateLimiter(1, 60_000, () => 0);
    for (let index = 0; index < 1000; index += 1) {
      expect(limiter.take(`10.0.0.${index}`).allowed).toBe(true);
    }
    expect(limiter.take('10.1.0.1').allowed).toBe(true);
    expect(limiter.take('10.0.0.0').allowed).toBe(true);
  });
});

describe('rateLimitMiddleware', () => {
  it('returns 429 without calling the rest of the stack', () => {
    const limiter = new RequestRateLimiter(1, 60_000, () => 5_000);
    const middleware = rateLimitMiddleware(limiter);
    const next = vi.fn() as NextFunction;
    const req = {
      method: 'GET',
      originalUrl: '/api/v1/health/live',
      url: '/api/v1/health/live',
      path: '/api/v1/health/live',
      socket: { remoteAddress: '127.0.0.1' },
      header: () => 'rate-check',
    } as unknown as Request;
    const headers = new Map<string, string>();
    let statusCode = 0;
    let body: unknown;
    const res = {
      setHeader(name: string, value: string) {
        headers.set(name, value);
      },
      status(code: number) {
        statusCode = code;
        return this;
      },
      json(payload: unknown) {
        body = payload;
        return this;
      },
    } as unknown as Response;

    middleware(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);

    middleware(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(statusCode).toBe(429);
    expect(headers.get('Retry-After')).toBe('60');
    expect(headers.get('X-Request-Id')).toBe('rate-check');
    expect(body).toMatchObject({
      statusCode: 429,
      error: 'too_many_requests',
      message: 'Too many requests from this client. Try again later.',
      correlationId: 'rate-check',
      path: '/api/v1/health/live',
    });
    expect(JSON.stringify(body)).not.toContain('dam_local_dev_only');
  });
});
