import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionProvider } from '@/shell/session';
import { SignInPage } from './SignInPage';

function renderPage() {
  return render(
    <MemoryRouter>
      <SessionProvider>
        <SignInPage />
      </SessionProvider>
    </MemoryRouter>,
  );
}

describe('SignInPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('asks for an email before calling the API', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        status: 401,
        ok: false,
        json: async () => ({ message: 'Sign in is required.' }),
      }),
    );
    renderPage();
    expect(await screen.findByRole('button', { name: 'Sign in' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Enter an email.')).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('shows the signed-in email after a successful session', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        status: 401,
        ok: false,
        json: async () => ({ message: 'Sign in is required.' }),
      })
      .mockResolvedValueOnce({
        status: 201,
        ok: true,
        json: async () => ({
          user: {
            id: 'user-1',
            email: 'person@example.com',
            status: 'active',
          },
          expiresAt: '2026-10-10T17:40:00.000Z',
        }),
      });
    vi.stubGlobal('fetch', fetchMock);
    renderPage();
    expect(await screen.findByRole('button', { name: 'Sign in' })).toBeEnabled();
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'person@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'correct-horse-battery' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('person@example.com')).toBeInTheDocument();
    expect(screen.getByText(/Company membership is listed/)).toBeInTheDocument();
    const post = fetchMock.mock.calls[1];
    expect(post?.[0]).toBe('/api/v1/session');
    expect(post?.[1]).toMatchObject({ method: 'POST', credentials: 'include' });
    expect(String(post?.[1].body)).not.toContain('passwordHash');
  });
});
