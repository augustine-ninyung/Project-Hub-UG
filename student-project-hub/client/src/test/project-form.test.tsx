import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectForm } from '@/features/projects/project-form';
import { metaService } from '@/services/project.service';
import { renderWithProviders } from './utils';

vi.mock('@/services/project.service', () => ({
  projectService: {},
  metaService: { categories: vi.fn(), technologies: vi.fn() },
}));

const CATEGORY_ID = '5b0f7d8e-0000-4000-8000-000000000001';

describe('ProjectForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(metaService.categories).mockResolvedValue([
      { id: CATEGORY_ID, name: 'Web Development', slug: 'web-development' },
    ]);
    vi.mocked(metaService.technologies).mockResolvedValue([
      { id: 't1', name: 'React', slug: 'react' },
    ]);
  });

  const renderForm = (onSubmit = vi.fn().mockResolvedValue(undefined)) => {
    renderWithProviders(
      <ProjectForm submitLabel="Publish project" onSubmit={onSubmit} uploadProgress={null} onCancel={vi.fn()} />,
    );
    return onSubmit;
  };

  it('blocks submission and shows validation errors', async () => {
    const onSubmit = renderForm();
    await userEvent.type(screen.getByLabelText(/GitHub repository/), 'not a url');
    await userEvent.click(screen.getByRole('button', { name: 'Publish project' }));

    expect(await screen.findByText('Title must be at least 3 characters')).toBeInTheDocument();
    expect(screen.getByText('Select a category', { selector: '[role=alert]' })).toBeInTheDocument();
    expect(screen.getByText('Add at least one technology')).toBeInTheDocument();
    expect(screen.getByText('Enter a valid URL starting with https://')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits a complete project with technologies and images', async () => {
    const onSubmit = renderForm();
    await screen.findByRole('option', { name: 'Web Development' });

    await userEvent.type(screen.getByLabelText(/Project title/), 'Campus Navigator');
    await userEvent.type(screen.getByLabelText(/Description/), 'Indoor navigation for lecture halls on campus.');
    await userEvent.selectOptions(screen.getByLabelText(/Category/), CATEGORY_ID);
    await userEvent.type(screen.getByLabelText(/Technologies used/), 'TypeScript{enter}');
    await userEvent.click(await screen.findByRole('button', { name: '+ React' }));

    const cover = new File(['img'], 'cover.png', { type: 'image/png' });
    fireEvent.change(screen.getByLabelText(/Upload a cover image/), { target: { files: [cover] } });
    expect(await screen.findByAltText('Cover preview')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Publish project' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const submission = onSubmit.mock.calls[0]![0];
    expect(submission.data).toMatchObject({
      title: 'Campus Navigator',
      categoryId: CATEGORY_ID,
      technologies: ['TypeScript', 'React'],
      status: 'ONGOING',
      visibility: 'PUBLIC',
      contributors: [],
    });
    expect(submission.cover).toBe(cover);
  });

  it('rejects oversized and non-image files before upload', async () => {
    renderForm();
    const huge = new File([new Uint8Array(6 * 1024 * 1024)], 'huge.png', { type: 'image/png' });
    fireEvent.change(screen.getByLabelText(/Upload a cover image/), { target: { files: [huge] } });
    expect(await screen.findByText(/images must be 5 MB or smaller/)).toBeInTheDocument();

    const pdf = new File(['%PDF'], 'doc.pdf', { type: 'application/pdf' });
    fireEvent.change(screen.getByLabelText(/Upload a cover image/), { target: { files: [pdf] } });
    expect(await screen.findByText(/only JPEG, PNG, WebP or GIF/)).toBeInTheDocument();
    expect(screen.queryByAltText('Cover preview')).not.toBeInTheDocument();
  });
});
