import { HttpException, NotFoundException } from '@nestjs/common';
import type { ArgumentsHost } from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter.js';

function hostFor(path: string): {
  host: ArgumentsHost;
  body: () => unknown;
  statusCode: () => number;
} {
  let statusCode = 0;
  let payload: unknown;
  const response = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(body: unknown) {
      payload = body;
    },
  };
  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => ({ originalUrl: path, url: path }),
    }),
  } as ArgumentsHost;

  return {
    host,
    body: () => payload,
    statusCode: () => statusCode,
  };
}

describe('AllExceptionsFilter', () => {
  const filter = new AllExceptionsFilter();

  it('returns a safe not-found body', () => {
    const captured = hostFor('/api/v1/missing');
    filter.catch(new NotFoundException('Cannot GET /api/v1/missing'), captured.host);

    expect(captured.statusCode()).toBe(404);
    expect(captured.body()).toMatchObject({
      statusCode: 404,
      error: 'not_found',
      message: 'Cannot GET /api/v1/missing',
      path: '/api/v1/missing',
    });
  });

  it('hides unexpected error details from the caller', () => {
    const captured = hostFor('/api/v1/health');
    filter.catch(new Error('boom secret-token'), captured.host);

    const body = captured.body() as { message: string };
    expect(captured.statusCode()).toBe(500);
    expect(body.message).toBe('An unexpected error occurred.');
    expect(JSON.stringify(body)).not.toContain('secret-token');
  });

  it('maps a database failure to an unavailable response without the driver text', () => {
    const captured = hostFor('/api/v1/health');
    filter.catch(
      new Error('password authentication failed for user dam'),
      captured.host,
    );

    const body = captured.body() as { message: string; error: string };
    expect(captured.statusCode()).toBe(503);
    expect(body.error).toBe('database_unavailable');
    expect(body.message).toBe('The database is unavailable.');
    expect(JSON.stringify(body)).not.toContain('password authentication');
  });

  it('turns a too-large upload into a client error', () => {
    const captured = hostFor('/api/v1/assets');
    filter.catch({ name: 'MulterError', code: 'LIMIT_FILE_SIZE', message: 'File too large' }, captured.host);
    const body = captured.body() as { message: string; error: string };
    expect(captured.statusCode()).toBe(400);
    expect(body.error).toBe('bad_request');
    expect(body.message).toBe('Choose a file of 20 MB or less with a plain file name.');
    expect(JSON.stringify(body)).not.toContain('File too large');
  });

  it('does not echo a server-side HttpException message', () => {
    const captured = hostFor('/api/v1/health');
    filter.catch(new HttpException('disk full at /var/lib', 500), captured.host);
    const body = captured.body() as { message: string; error: string };
    expect(body.error).toBe('internal_error');
    expect(body.message).toBe('An unexpected error occurred.');
  });
});
