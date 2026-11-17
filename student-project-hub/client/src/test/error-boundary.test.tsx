import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ErrorBoundary } from '@/components/common/error-boundary';
import PrivacyPage from '@/pages/privacy-page';
import { renderWithProviders } from './utils';

function Crash(): never {
  throw new Error('Cannot read properties of undefined');
}

describe('crash screen', () => {
  it('shows a friendly page instead of a blank one, and reports the crash', () => {
    const onError = vi.fn();
    vi.spyOn(console, 'error').mockImplementation(() => {}); // React logs caught errors
    renderWithProviders(
      <ErrorBoundary onError={onError}>
        <Crash />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('heading', { name: 'Something went wrong' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reload page/ })).toBeInTheDocument();
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'Cannot read properties of undefined' }), expect.anything());
  });

  it('asks for a reload after a new release instead of reporting an error', () => {
    function Stale(): never {
      throw new Error('Failed to fetch dynamically imported module: /assets/page-abc.js');
    }
    vi.spyOn(console, 'error').mockImplementation(() => {});
    renderWithProviders(
      <ErrorBoundary onError={() => {}}>
        <Stale />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('heading', { name: 'ProjectHub was updated' })).toBeInTheDocument();
  });
});

describe('privacy page', () => {
  it('covers the main topics and links to Settings', () => {
    renderWithProviders(<PrivacyPage />, { user: null });
    for (const heading of ['What we keep', 'What others can see', 'Services we rely on', 'How long we keep it', 'Your choices']) {
      expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument();
    }
    expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute('href', '/settings');
  });
});
