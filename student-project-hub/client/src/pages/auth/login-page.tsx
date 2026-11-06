import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { FormAlert } from '@/components/common/form-alert';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/form-controls';
import { useAuth } from '@/context/auth-context';
import { loginSchema, type LoginValues } from '@/features/auth/schemas';
import { applyServerErrors } from '@/hooks/use-server-errors';
import { getErrorCode } from '@/services/api';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/';

  const {
    register,
    handleSubmit,
    getValues,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) });
  // The account has a pending deletion request; offer to keep it.
  const [deletionPending, setDeletionPending] = useState(false);
  const [keeping, setKeeping] = useState(false);

  const signIn = async (values: LoginValues, cancelDeletion = false) => {
    const user = await login(values.identifier, values.password, cancelDeletion);
    toast.success(
      cancelDeletion
        ? 'Your account is kept and the deletion request is cancelled.'
        : `Welcome back, ${user.fullName.split(' ')[0]}!`,
    );
    navigate(from, { replace: true });
  };

  const onSubmit = async (values: LoginValues) => {
    setDeletionPending(false);
    try {
      await signIn(values);
    } catch (err) {
      if (getErrorCode(err) === 'ACCOUNT_DELETION_PENDING') setDeletionPending(true);
      else applyServerErrors(err, setError, []);
    }
  };

  const keepAccount = async () => {
    setKeeping(true);
    try {
      await signIn(getValues(), true);
    } catch (err) {
      setDeletionPending(false);
      applyServerErrors(err, setError, []);
    } finally {
      setKeeping(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
        <p className="text-sm text-muted-foreground">
          New here?{' '}
          <Link to="/register" className="font-medium text-primary hover:underline">
            Create an account
          </Link>
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <FormAlert>{errors.root?.message}</FormAlert>
        {deletionPending && (
          <div role="alert" className="space-y-3 rounded-md border border-warning/40 bg-warning/10 p-3 text-sm animate-fade-in">
            <p>
              You asked for this account to be deleted, and an admin will confirm it soon. Want to keep it instead?
            </p>
            <Button type="button" size="sm" onClick={keepAccount} loading={keeping}>
              Keep my account and sign in
            </Button>
          </div>
        )}
        <Field label="Email or username" htmlFor="identifier" error={errors.identifier?.message}>
          <Input
            id="identifier"
            autoComplete="username"
            autoFocus
            aria-invalid={!!errors.identifier}
            {...register('identifier')}
          />
        </Field>
        <Field label="Password" htmlFor="password" error={errors.password?.message}>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            aria-invalid={!!errors.password}
            {...register('password')}
          />
        </Field>
        <div className="flex justify-end">
          <Link to="/forgot-password" className="text-sm text-muted-foreground hover:text-foreground">
            Forgot password?
          </Link>
        </div>
        <Button type="submit" className="w-full" loading={isSubmitting}>
          Sign in
        </Button>
      </form>
    </div>
  );
}
