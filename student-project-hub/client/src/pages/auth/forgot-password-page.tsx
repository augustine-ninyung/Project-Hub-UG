import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import type { z } from 'zod';
import { FormAlert } from '@/components/common/form-alert';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/form-controls';
import { forgotPasswordSchema } from '@/features/auth/schemas';
import { applyServerErrors } from '@/hooks/use-server-errors';
import { authService } from '@/services/auth.service';

type Values = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPasswordPage() {
  const [sentMessage, setSentMessage] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(forgotPasswordSchema) });

  const onSubmit = async ({ email }: Values) => {
    try {
      const res = await authService.forgotPassword(email);
      setSentMessage(res.message);
    } catch (err) {
      applyServerErrors(err, setError, ['email']);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Reset your password</h1>
        <p className="text-sm text-muted-foreground">
          Enter the email you registered with and we'll send you a reset link.
        </p>
      </div>
      {sentMessage ? (
        <FormAlert variant="success">{sentMessage}</FormAlert>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <FormAlert>{errors.root?.message}</FormAlert>
          <Field label="Email" htmlFor="email" error={errors.email?.message}>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              autoFocus
              aria-invalid={!!errors.email}
              {...register('email')}
            />
          </Field>
          <Button type="submit" className="w-full" loading={isSubmitting}>
            Send reset link
          </Button>
        </form>
      )}
      <Link
        to="/login"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Back to sign in
      </Link>
    </div>
  );
}
