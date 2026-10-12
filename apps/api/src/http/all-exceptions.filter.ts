import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { writeLog } from '../logging/json-logger.js';
import { redact } from '../logging/redact.js';
import { correlationIdFrom } from './request-context.js';
import { isLikelyDatabaseError } from '../health/database-error.js';

type ErrorBody = {
  statusCode: number;
  error: string;
  message: string;
  correlationId: string;
  timestamp: string;
  path: string;
};

const CATEGORY_BY_STATUS: Record<number, string> = {
  400: 'bad_request',
  401: 'unauthorized',
  403: 'forbidden',
  404: 'not_found',
  409: 'conflict',
  422: 'validation_failed',
  429: 'too_many_requests',
  503: 'service_unavailable',
};

function isFileTooLarge(exception: unknown): boolean {
  return (
    typeof exception === 'object' &&
    exception !== null &&
    'name' in exception &&
    exception.name === 'MulterError' &&
    'code' in exception &&
    exception.code === 'LIMIT_FILE_SIZE'
  );
}

function publicHttpMessage(exception: HttpException): string {
  const response = exception.getResponse();
  if (typeof response === 'string') {
    return response;
  }
  if (typeof response === 'object' && response && 'message' in response) {
    const message = (response as { message: unknown }).message;
    if (typeof message === 'string') {
      return message;
    }
    if (
      Array.isArray(message) &&
      message.every((item) => typeof item === 'string')
    ) {
      return message.join('; ');
    }
  }
  return exception.message;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const response = http.getResponse<Response>();
    const request = http.getRequest<Request>();
    const correlationId = correlationIdFrom(request);

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let error = 'internal_error';
    let message = 'An unexpected error occurred.';

    if (isFileTooLarge(exception)) {
      status = HttpStatus.BAD_REQUEST;
      error = 'bad_request';
      message = 'Choose a file of 20 MB or less with a plain file name.';
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      error = CATEGORY_BY_STATUS[status] ?? (status >= 500 ? 'internal_error' : 'request_failed');
      message =
        status >= 500
          ? 'An unexpected error occurred.'
          : publicHttpMessage(exception);
    } else if (isLikelyDatabaseError(exception)) {
      status = HttpStatus.SERVICE_UNAVAILABLE;
      error = 'database_unavailable';
      message = 'The database is unavailable.';
    }

    const detail =
      exception instanceof Error ? redact(exception.message) : 'unknown';
    writeLog(status >= 500 ? 'error' : 'warn', 'request.failed', {
      context: 'ExceptionFilter',
      correlationId,
      statusCode: status,
      error,
      path: request.originalUrl ?? request.url,
      detail: status >= 500 ? detail : undefined,
    });

    const body: ErrorBody = {
      statusCode: status,
      error,
      message,
      correlationId,
      timestamp: new Date().toISOString(),
      path: request.originalUrl ?? request.url,
    };
    response.status(status).json(body);
  }
}
