import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LikeButton } from '@/features/projects/like-button';
import { projectService } from '@/services/project.service';
import { renderWithProviders } from './utils';

vi.mock('@/services/project.service', () => ({
  projectService: { like: vi.fn(), unlike: vi.fn() },
  metaService: {},
}));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

describe('LikeButton', () => {
  beforeEach(() => vi.clearAllMocks());

  it('likes optimistically and applies the server count', async () => {
    let resolve!: (v: { liked: boolean; likeCount: number }) => void;
    vi.mocked(projectService.like).mockReturnValue(new Promise((r) => (resolve = r)));
    renderWithProviders(<LikeButton projectId="p1" liked={false} count={4} />);

    const button = screen.getByRole('button', { name: 'Like project' });
    await userEvent.click(button);

    // Optimistic state before the server answers.
    expect(button).toHaveAttribute('aria-pressed', 'true');
    expect(button).toHaveTextContent('5');

    resolve({ liked: true, likeCount: 9 });
    await waitFor(() => expect(button).toHaveTextContent('9'));
    expect(projectService.like).toHaveBeenCalledWith('p1');
  });

  it('rolls back when the server rejects the like', async () => {
    vi.mocked(projectService.like).mockRejectedValue(new Error('network'));
    renderWithProviders(<LikeButton projectId="p1" liked={false} count={4} />);

    const button = screen.getByRole('button', { name: 'Like project' });
    await userEvent.click(button);

    await waitFor(() => expect(button).toHaveAttribute('aria-pressed', 'false'));
    expect(button).toHaveTextContent('4');
  });

  it('unlikes a liked project', async () => {
    vi.mocked(projectService.unlike).mockResolvedValue({ liked: false, likeCount: 3 });
    renderWithProviders(<LikeButton projectId="p1" liked count={4} />);

    await userEvent.click(screen.getByRole('button', { name: 'Unlike project' }));
    await waitFor(() => expect(projectService.unlike).toHaveBeenCalledWith('p1'));
    expect(await screen.findByRole('button', { name: 'Like project' })).toHaveTextContent('3');
  });

  it('sends anonymous visitors to the login page', async () => {
    renderWithProviders(<LikeButton projectId="p1" liked={false} count={4} />, { user: null });
    await userEvent.click(screen.getByRole('button', { name: 'Like project' }));
    expect(await screen.findByText('Login page')).toBeInTheDocument();
    expect(projectService.like).not.toHaveBeenCalled();
  });
});
