import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DesignSystemPage } from '@/pages/DesignSystemPage';

describe('DesignSystemPage', () => {
  it('filters sections by name', () => {
    render(<DesignSystemPage />);
    fireEvent.change(screen.getByLabelText('Filter components'), {
      target: { value: 'dialog' },
    });
    expect(
      screen.getByRole('heading', { name: 'Confirmation dialog' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Buttons' })).not.toBeInTheDocument();
  });

  it('shows a validation error and then accepts a title', () => {
    render(<DesignSystemPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Check example' }));
    expect(screen.getByText('Enter at least 3 characters.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Example title'), {
      target: { value: 'Poster' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Check example' }));
    expect(screen.getByText(/Accepted example title/)).toBeInTheDocument();
    expect(screen.getByText(/Nothing was saved/)).toBeInTheDocument();
  });

  it('confirms before discarding the example', () => {
    render(<DesignSystemPage />);
    fireEvent.change(screen.getByLabelText('Example title'), {
      target: { value: 'Poster' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Discard example' }));
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }));
    expect(screen.getByText('Example discarded.')).toBeInTheDocument();
    expect(screen.getByLabelText('Example title')).toHaveValue('');
  });

  it('shows an empty filter result', () => {
    render(<DesignSystemPage />);
    fireEvent.change(screen.getByLabelText('Filter components'), {
      target: { value: 'zzzz' },
    });
    expect(screen.getByText('No matching components')).toBeInTheDocument();
  });
});