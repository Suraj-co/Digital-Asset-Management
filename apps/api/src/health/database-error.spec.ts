import { classifyDatabaseError } from './database-error.js';

describe('classifyDatabaseError', () => {
  it('recognises a refused connection', () => {
    expect(
      classifyDatabaseError(new Error('connect ECONNREFUSED 127.0.0.1:5432')),
    ).toBe('connection_refused');
  });

  it('recognises rejected credentials', () => {
    expect(
      classifyDatabaseError(new Error('password authentication failed')),
    ).toBe('authentication_failed');
  });

  it('recognises a timeout', () => {
    expect(classifyDatabaseError(new Error('connect ETIMEDOUT'))).toBe(
      'timeout',
    );
  });

  it('falls back when the failure is not recognised', () => {
    expect(classifyDatabaseError(new Error('something else'))).toBe(
      'database_unavailable',
    );
  });
});
