import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import type { z } from 'zod';
import { FormAlert } from '@/components/common/form-alert';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/form-controls';
import { AUTH_QUERY_KEY } from '@/context/auth-context';
import { resetPasswordSchema } from '@/features/auth/schemas';
import { applyServerErrors } from '@/hooks/use-server-errors';
import { authService } from '@/services/auth.service';

type Values = z.infer<typeof resetPasswordSchema>;

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(resetPasswordSchema) });

  if (!token) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">Invalid link</h1>
        <FormAlert>This password reset link is missing its token.</FormAlert>
        <Button asChild variant="outline">
          <Link to="/forgot-password">Request a new link</Link>
        </Button>
      </div>
    );
  }

  const onSubmit = async ({ password }: Values) => {
    try {
      const res = await authService.resetPassword(token, password);
      // All sessions were revoked server-side.
      queryClient.setQueryData(AUTH_QUERY_KEY, null);
      toast.success(res.message);
      navigate('/login', { replace: true });
    } catch (err) {
      applyServerErrors(err, setError, ['password']);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Choose a new password</h1>
        <p className="text-sm text-muted-foreground">
          You'll be signed out of all devices after the change.
        </p>
      </div>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <FormAlert>
          {errors.root?.message}
          {errors.root && (
            <>
              {' '}
              <Link to="/forgot-password" className="underline">
                Request a new link
              </Link>
            </>
          )}
        </FormAlert>
        <Field label="New password" htmlFor="password" error={errors.password?.message}>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            autoFocus
            aria-invalid={!!errors.password}
            {...register('password')}
          />
        </Field>
        <Field label="Confirm password" htmlFor="confirmPassword" error={errors.confirmPassword?.message}>
          <Input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            aria-invalid={!!errors.confirmPassword}
            {...register('confirmPassword')}
          />
        </Field>
        <Button type="submit" className="w-full" loading={isSubmitting}>
          Update password
        </Button>
      </form>
    </div>
  );
}
