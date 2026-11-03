import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CommentSection } from '@/features/comments/comment-section';
import { projectService } from '@/services/project.service';
import type { CommentNode } from '@/types/api';
import { renderWithProviders, testUser } from './utils';

vi.mock('@/services/project.service', () => ({
  projectService: { comments: vi.fn(), addComment: vi.fn(), editComment: vi.fn(), deleteComment: vi.fn() },
  metaService: {},
}));

const author = { ...testUser, id: 'u2', username: 'kofi', fullName: 'Kofi Adjei' };
const comment: CommentNode = {
  id: 'c1',
  content: 'Great project!',
  parentId: null,
  isEdited: false,
  isDeleted: false,
  createdAt: new Date().toISOString(),
  author,
  replies: [
    {
      id: 'c2',
      content: 'Thank you!',
      parentId: 'c1',
      isEdited: false,
      isDeleted: false,
      createdAt: new Date().toISOString(),
      author: testUser,
      replies: [],
    },
  ],
};
const page = (items: CommentNode[]) => ({
  items,
  meta: { page: 1, limit: 10, total: items.length, totalPages: 1 },
});

describe('CommentSection', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders threaded comments', async () => {
    vi.mocked(projectService.comments).mockResolvedValue(page([comment]));
    renderWithProviders(<CommentSection projectId="p1" count={2} />);

    expect(await screen.findByText('Great project!')).toBeInTheDocument();
    expect(screen.getByText('Thank you!')).toBeInTheDocument();
    expect(screen.getByRole('article', { name: 'Comment by Kofi Adjei' })).toBeInTheDocument();
  });

  it('posts a comment and refetches the thread', async () => {
    vi.mocked(projectService.comments).mockResolvedValue(page([]));
    vi.mocked(projectService.addComment).mockResolvedValue({ ...comment, replies: [] });
    renderWithProviders(<CommentSection projectId="p1" count={0} />);

    await screen.findByText('No comments yet');
    await userEvent.type(screen.getByLabelText('Share feedback or ask a question…'), 'Nice work');
    vi.mocked(projectService.comments).mockResolvedValue(page([{ ...comment, replies: [] }]));
    await userEvent.click(screen.getByRole('button', { name: 'Comment' }));

    await waitFor(() => expect(projectService.addComment).toHaveBeenCalledWith('p1', 'Nice work', undefined));
    expect(await screen.findByText('Great project!')).toBeInTheDocument();
  });

  it('keeps the draft and shows an error when posting fails', async () => {
    vi.mocked(projectService.comments).mockResolvedValue(page([]));
    vi.mocked(projectService.addComment).mockRejectedValue(new Error('offline'));
    renderWithProviders(<CommentSection projectId="p1" count={0} />);

    await screen.findByText('No comments yet');
    const box = screen.getByLabelText('Share feedback or ask a question…');
    await userEvent.type(box, 'Do not lose me');
    await userEvent.click(screen.getByRole('button', { name: 'Comment' }));

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(box).toHaveValue('Do not lose me');
  });

  it('asks anonymous visitors to sign in instead of showing the composer', async () => {
    vi.mocked(projectService.comments).mockResolvedValue(page([comment]));
    renderWithProviders(<CommentSection projectId="p1" count={2} />, { user: null });

    await screen.findByText('Great project!');
    expect(screen.queryByRole('button', { name: 'Comment' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Reply/ })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sign in' })).toBeInTheDocument();
  });
});
