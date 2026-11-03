import { zodResolver } from '@hookform/resolvers/zod';
import { Globe, Lock, X } from 'lucide-react';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { FormAlert } from '@/components/common/form-alert';
import { TagInput } from '@/components/common/tag-input';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/form-controls';
import { Card, UserAvatar } from '@/components/ui/misc';
import { UserPicker } from '@/features/users/user-picker';
import { applyServerErrors } from '@/hooks/use-server-errors';
import type { ProjectFormPayload } from '@/services/project.service';
import type { ProjectDetail, UserSummary } from '@/types/api';
import { cn } from '@/utils/cn';
import { STATUS_LABELS } from '@/utils/format';
import { useCategories, useTechnologies } from './hooks';
import { CoverPicker, ScreenshotPicker } from './image-picker';

const optionalUrl = z
  .string()
  .trim()
  .max(500)
  .refine((v) => v === '' || /^https?:\/\/[^\s.]+\.[^\s]+$/i.test(v), 'Enter a valid URL starting with https://');

export const projectFormSchema = z.object({
  title: z.string().trim().min(3, 'Title must be at least 3 characters').max(120),
  description: z
    .string()
    .trim()
    .min(20, 'Describe your project in at least 20 characters')
    .max(10_000, 'Description must be at most 10,000 characters'),
  categoryId: z.string().min(1, 'Select a category'),
  technologies: z.array(z.string()).min(1, 'Add at least one technology').max(15),
  githubUrl: optionalUrl,
  liveUrl: optionalUrl,
  status: z.enum(['PLANNING', 'ONGOING', 'COMPLETED']),
  visibility: z.enum(['PUBLIC', 'PRIVATE']),
});

export type ProjectFormValues = z.infer<typeof projectFormSchema>;

export interface ProjectFormSubmission {
  data: ProjectFormPayload;
  cover: File | null;
  screenshots: File[];
}

interface ProjectFormProps {
  project?: ProjectDetail;
  submitLabel: string;
  onSubmit: (submission: ProjectFormSubmission) => Promise<unknown>;
  uploadProgress: number | null;
  onCancel: () => void;
}

const FIELDS = ['title', 'description', 'categoryId', 'technologies', 'githubUrl', 'liveUrl', 'status', 'visibility'] as const;

export function ProjectForm({ project, submitLabel, onSubmit, uploadProgress, onCancel }: ProjectFormProps) {
  const isEdit = Boolean(project);
  const categories = useCategories();
  const [techQuery, setTechQuery] = useState('');
  const technologies = useTechnologies(techQuery);

  const [cover, setCover] = useState<File | null>(null);
  const [removeCover, setRemoveCover] = useState(false);
  const [screenshots, setScreenshots] = useState<File[]>([]);
  const [removedScreenshotIds, setRemovedScreenshotIds] = useState<string[]>([]);
  const [contributors, setContributors] = useState<(UserSummary & { role: string })[]>([]);
  const [imageError, setImageError] = useState<string | null>(null);

  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ProjectFormValues>({
    resolver: zodResolver(projectFormSchema),
    defaultValues: {
      title: project?.title ?? '',
      description: project?.description ?? '',
      categoryId: project?.category.id ?? '',
      technologies: project?.technologies.map((t) => t.name) ?? [],
      githubUrl: project?.githubUrl ?? '',
      liveUrl: project?.liveUrl ?? '',
      status: project?.status ?? 'ONGOING',
      visibility: project?.visibility ?? 'PUBLIC',
    },
  });

  const submit = async (values: ProjectFormValues) => {
    setImageError(null);
    try {
      await onSubmit({
        data: {
          ...values,
          ...(isEdit
            ? { removeScreenshotIds: removedScreenshotIds, removeCover: removeCover && !cover }
            : {
                contributors: contributors.map((c) => ({
                  username: c.username,
                  role: c.role.trim() || undefined,
                })),
              }),
        },
        cover,
        screenshots,
      });
    } catch (err) {
      applyServerErrors(err, setError, FIELDS);
    }
  };

  const existingScreenshots = (project?.images ?? []).filter((i) => !removedScreenshotIds.includes(i.id));
  const reg = (name: keyof ProjectFormValues) => ({
    id: name,
    'aria-invalid': !!errors[name],
    ...register(name),
  });

  return (
    <form onSubmit={handleSubmit(submit)} noValidate className="space-y-6">
      <FormAlert>{errors.root?.message}</FormAlert>

      <Card className="space-y-5 p-5 sm:p-6">
        <h2 className="font-semibold">Basics</h2>
        <Field label="Project title" htmlFor="title" error={errors.title?.message} required>
          <Input placeholder="e.g. CampusEats — pre-order from campus canteens" {...reg('title')} />
        </Field>
        <Field
          label="Description"
          htmlFor="description"
          error={errors.description?.message}
          hint="What problem does it solve? How does it work? What did you learn?"
          required
        >
          <Textarea rows={8} {...reg('description')} />
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Category" htmlFor="categoryId" error={errors.categoryId?.message} required>
            <Select {...reg('categoryId')}>
              <option value="">Select a category</option>
              {categories.data?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Status" htmlFor="status" error={errors.status?.message} required>
            <Select {...reg('status')}>
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field
          label="Technologies used"
          htmlFor="technologies"
          error={errors.technologies?.message}
          hint="Press Enter or comma to add. Up to 15."
          required
        >
          <Controller
            control={control}
            name="technologies"
            render={({ field }) => (
              <TagInput
                id="technologies"
                value={field.value}
                onChange={field.onChange}
                onQueryChange={setTechQuery}
                suggestions={technologies.data?.map((t) => t.name)}
                placeholder="React, Python, Arduino…"
                invalid={!!errors.technologies}
              />
            )}
          />
        </Field>
      </Card>

      <Card className="space-y-5 p-5 sm:p-6">
        <h2 className="font-semibold">Images</h2>
        <FormAlert>{imageError}</FormAlert>
        <div className="space-y-2">
          <p className="text-sm font-medium">Cover image</p>
          <CoverPicker
            file={cover}
            existingUrl={removeCover ? null : (project?.coverImageUrl ?? null)}
            onChange={(f) => {
              setImageError(null);
              setCover(f);
            }}
            onRemoveExisting={() => setRemoveCover(true)}
            onError={setImageError}
          />
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium">Screenshots</p>
          <ScreenshotPicker
            files={screenshots}
            existing={existingScreenshots}
            onChange={(f) => {
              setImageError(null);
              setScreenshots(f);
            }}
            onRemoveExisting={(id) => setRemovedScreenshotIds((ids) => [...ids, id])}
            onError={setImageError}
          />
        </div>
      </Card>

      <Card className="space-y-5 p-5 sm:p-6">
        <h2 className="font-semibold">Links</h2>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="GitHub repository" htmlFor="githubUrl" error={errors.githubUrl?.message}>
            <Input type="url" placeholder="https://github.com/you/project" {...reg('githubUrl')} />
          </Field>
          <Field label="Live demo" htmlFor="liveUrl" error={errors.liveUrl?.message}>
            <Input type="url" placeholder="https://your-project.app" {...reg('liveUrl')} />
          </Field>
        </div>
      </Card>

      <Card className="space-y-5 p-5 sm:p-6">
        <h2 className="font-semibold">Visibility</h2>
        <Controller
          control={control}
          name="visibility"
          render={({ field }) => (
            <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Visibility">
              {(
                [
                  { value: 'PUBLIC', icon: Globe, title: 'Public', text: 'Anyone can discover and view it.' },
                  { value: 'PRIVATE', icon: Lock, title: 'Private', text: 'Only you, contributors and admins.' },
                ] as const
              ).map((opt) => (
                <label
                  key={opt.value}
                  className={cn(
                    'flex cursor-pointer gap-3 rounded-lg border p-4 transition-colors hover:bg-accent/50',
                    field.value === opt.value && 'border-primary bg-primary/5 ring-1 ring-primary',
                  )}
                >
                  <input
                    type="radio"
                    className="sr-only"
                    name="visibility"
                    value={opt.value}
                    checked={field.value === opt.value}
                    onChange={() => field.onChange(opt.value)}
                  />
                  <opt.icon className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
                  <span>
                    <span className="block text-sm font-medium">{opt.title}</span>
                    <span className="block text-sm text-muted-foreground">{opt.text}</span>
                  </span>
                </label>
              ))}
            </div>
          )}
        />
      </Card>

      {!isEdit && (
        <Card className="space-y-4 p-5 sm:p-6">
          <div>
            <h2 className="font-semibold">Contributors</h2>
            <p className="text-sm text-muted-foreground">
              Invite teammates. They'll appear on the project once they accept.
            </p>
          </div>
          <UserPicker
            excludeIds={contributors.map((c) => c.id)}
            onSelect={(u) =>
              contributors.length < 10 && setContributors((list) => [...list, { ...u, role: '' }])
            }
          />
          {contributors.length > 0 && (
            <ul className="divide-y rounded-lg border">
              {contributors.map((c, i) => (
                <li key={c.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center">
                  <span className="flex min-w-0 flex-1 items-center gap-3">
                    <UserAvatar user={c} size="sm" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{c.fullName}</span>
                      <span className="block text-xs text-muted-foreground">@{c.username}</span>
                    </span>
                  </span>
                  <div className="flex gap-2">
                    <Input
                      value={c.role}
                      onChange={(e) =>
                        setContributors((list) =>
                          list.map((x, j) => (j === i ? { ...x, role: e.target.value } : x)),
                        )
                      }
                      placeholder="Role (optional)"
                      maxLength={60}
                      className="sm:w-48"
                      aria-label={`Role for ${c.fullName}`}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setContributors((list) => list.filter((x) => x.id !== c.id))}
                      aria-label={`Remove ${c.fullName}`}
                    >
                      <X />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {uploadProgress !== null && (
        <div className="space-y-1.5" role="status" aria-live="polite">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{uploadProgress < 100 ? 'Uploading…' : 'Processing images…'}</span>
            <span className="tabular-nums">{uploadProgress}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-[width]"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" loading={isSubmitting}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
