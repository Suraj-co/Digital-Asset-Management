import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import type { Request } from 'express';

export type RequestContextStore = {
  correlationId: string;
};

export type RequestWithCorrelation = Request & {
  correlationId?: string;
};

export const requestContext = new AsyncLocalStorage<RequestContextStore>();

const SAFE_CORRELATION_ID = /^[A-Za-z0-9._:-]{1,128}$/;

export function resolveCorrelationId(header: string | undefined): string {
  if (header && SAFE_CORRELATION_ID.test(header)) {
    return header;
  }
  return randomUUID();
}

export function currentCorrelationId(): string {
  return requestContext.getStore()?.correlationId ?? randomUUID();
}

export function correlationIdFrom(req: Request | undefined): string {
  const attached = (req as RequestWithCorrelation | undefined)?.correlationId;
  if (attached) {
    return attached;
  }
  const header = req?.header?.('x-request-id');
  return resolveCorrelationId(header);
}
