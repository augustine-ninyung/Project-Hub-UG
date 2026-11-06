import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Camera, Trash2 } from 'lucide-react';
import { useRef } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { FormAlert } from '@/components/common/form-alert';
import { PageHeader } from '@/components/common/section';
import { DeleteAccountCard } from '@/features/account/delete-account';
import { TagInput } from '@/components/common/tag-input';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/form-controls';
import { Card, UserAvatar } from '@/components/ui/misc';
import { useAuth } from '@/context/auth-context';
import { usernameSchema } from '@/features/auth/schemas';
import { validateImage } from '@/features/projects/image-picker';
import { applyServerErrors } from '@/hooks/use-server-errors';
import { getErrorMessage } from '@/services/api';
import { userService } from '@/services/user.service';

const url = z
  .string()
  .trim()
  .max(500)
  .refine((v) => v === '' || /^https?:\/\/[^\s.]+\.[^\s]+$/i.test(v), 'Enter a valid URL starting with https://');

const profileSchema = z.object({
  fullName: z.string().trim().min(2, 'Enter your full name').max(100),
  username: usernameSchema,
  university: z.string().trim().min(2, 'Enter your university').max(150),
  department: z.string().trim().min(2, 'Enter your department').max(150),
  bio: z.string().trim().max(1000, 'Bio must be at most 1,000 characters'),
  skills: z.array(z.string()).max(30),
  githubUrl: url,
  linkedinUrl: url,
  portfolioUrl: url,
});

type ProfileValues = z.infer<typeof profileSchema>;
const FIELDS = Object.keys(profileSchema.shape);

export default function SettingsPage() {
  const { user, setUser } = useAuth();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting, isDirty },
    reset,
  } = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      fullName: user!.fullName,
      username: user!.username,
      university: user!.university,
      department: user!.department,
      bio: user!.bio ?? '',
      skills: user!.skills,
      githubUrl: user!.githubUrl ?? '',
      linkedinUrl: user!.linkedinUrl ?? '',
      portfolioUrl: user!.portfolioUrl ?? '',
    },
  });

  const onSaved = (updated: NonNullable<typeof user>) => {
    setUser(updated);
    queryClient.invalidateQueries({ queryKey: ['profile'] });
  };

  const avatar = useMutation({
    mutationFn: userService.uploadAvatar,
    onSuccess: (u) => {
      onSaved(u);
      toast.success('Profile picture updated');
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });
  const removeAvatar = useMutation({
    mutationFn: userService.removeAvatar,
    onSuccess: (u) => {
      onSaved(u);
      toast.success('Profile picture removed');
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const onSubmit = async (values: ProfileValues) => {
    try {
      const updated = await userService.updateMe({ ...values, bio: values.bio || null });
      onSaved(updated);
      reset({ ...values, username: updated.username });
      toast.success('Profile saved');
    } catch (err) {
      const message = getErrorMessage(err);
      if (/username/i.test(message)) setError('username', { message });
      else applyServerErrors(err, setError, FIELDS);
    }
  };

  if (!user) return null;
  const reg = (name: keyof ProfileValues) => ({ id: name, 'aria-invalid': !!errors[name], ...register(name) });

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Settings" description="Manage how you appear to the community." />

      <div className="space-y-6">
        <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:p-6">
          <UserAvatar user={user} size="lg" className="size-20 text-2xl" />
          <div className="flex-1">
            <h2 className="font-semibold">Profile picture</h2>
            <p className="text-sm text-muted-foreground">JPEG, PNG, WebP or GIF, up to 20 MB.</p>
          </div>
          <div className="flex gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="sr-only"
              aria-label="Upload profile picture"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (!file) return;
                const err = validateImage(file);
                if (err) toast.error(err);
                else avatar.mutate(file);
              }}
            />
            <Button variant="outline" onClick={() => fileRef.current?.click()} loading={avatar.isPending}>
              <Camera /> Upload
            </Button>
            {user.avatarUrl && (
              <Button
                variant="ghost"
                onClick={() => removeAvatar.mutate()}
                loading={removeAvatar.isPending}
                aria-label="Remove profile picture"
              >
                <Trash2 />
              </Button>
            )}
          </div>
        </Card>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6">
          <FormAlert>{errors.root?.message}</FormAlert>
          <Card className="space-y-5 p-5 sm:p-6">
            <h2 className="font-semibold">Personal details</h2>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Full name" htmlFor="fullName" error={errors.fullName?.message} required>
                <Input {...reg('fullName')} />
              </Field>
              <Field label="Username" htmlFor="username" error={errors.username?.message} required>
                <Input {...reg('username')} />
              </Field>
              <Field label="University" htmlFor="university" error={errors.university?.message} required>
                <Input {...reg('university')} />
              </Field>
              <Field label="Department or programme" htmlFor="department" error={errors.department?.message} required>
                <Input {...reg('department')} />
              </Field>
            </div>
            <Field label="Email" htmlFor="email" hint="Your email is never shown publicly.">
              <Input id="email" value={user.email} disabled readOnly />
            </Field>
            <Field label="Bio" htmlFor="bio" error={errors.bio?.message}>
              <Textarea rows={4} placeholder="Tell others what you build and what you're learning" {...reg('bio')} />
            </Field>
            <Field label="Skills & interests" htmlFor="skills" error={errors.skills?.message} hint="Press Enter or comma to add.">
              <Controller
                control={control}
                name="skills"
                render={({ field }) => (
                  <TagInput id="skills" value={field.value} onChange={field.onChange} max={30} placeholder="e.g. React, Machine Learning" />
                )}
              />
            </Field>
          </Card>

          <Card className="space-y-5 p-5 sm:p-6">
            <h2 className="font-semibold">Links</h2>
            <Field label="GitHub profile" htmlFor="githubUrl" error={errors.githubUrl?.message}>
              <Input type="url" placeholder="https://github.com/username" {...reg('githubUrl')} />
            </Field>
            <Field label="LinkedIn profile" htmlFor="linkedinUrl" error={errors.linkedinUrl?.message}>
              <Input type="url" placeholder="https://linkedin.com/in/username" {...reg('linkedinUrl')} />
            </Field>
            <Field label="Portfolio website" htmlFor="portfolioUrl" error={errors.portfolioUrl?.message}>
              <Input type="url" placeholder="https://your-site.dev" {...reg('portfolioUrl')} />
            </Field>
          </Card>

          <div className="flex justify-end">
            <Button type="submit" loading={isSubmitting} disabled={!isDirty}>
              Save changes
            </Button>
          </div>
        </form>

        <DeleteAccountCard />
      </div>
    </div>
  );
}
