import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { FormAlert } from '@/components/common/form-alert';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/form-controls';
import { useAuth } from '@/context/auth-context';
import { registerSchema, type RegisterValues } from '@/features/auth/schemas';
import { applyServerErrors } from '@/hooks/use-server-errors';
import { getErrorMessage } from '@/services/api';

const FIELDS = ['fullName', 'username', 'email', 'password', 'university', 'department'] as const;

export default function RegisterPage() {
  const { register: signUp } = useAuth();
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterValues>({ resolver: zodResolver(registerSchema) });

  const onSubmit = async ({ confirmPassword: _confirm, ...values }: RegisterValues) => {
    try {
      await signUp(values);
      toast.success('Account created! Check your email to verify your address.');
      navigate('/');
    } catch (err) {
      // 409s identify which unique field clashed.
      const message = getErrorMessage(err);
      if (/username/i.test(message)) setError('username', { message });
      else if (/email/i.test(message)) setError('email', { message });
      else applyServerErrors(err, setError, FIELDS);
    }
  };

  const fieldProps = (name: keyof RegisterValues) => ({
    id: name,
    'aria-invalid': !!errors[name],
    'aria-describedby': errors[name] ? `${name}-error` : undefined,
    ...register(name),
  });

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Create your account</h1>
        <p className="text-sm text-muted-foreground">
          Already a member?{' '}
          <Link to="/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <FormAlert>{errors.root?.message}</FormAlert>
        <Field label="Full name" htmlFor="fullName" error={errors.fullName?.message} required>
          <Input autoComplete="name" autoFocus {...fieldProps('fullName')} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Username" htmlFor="username" error={errors.username?.message} required>
            <Input autoComplete="username" {...fieldProps('username')} />
          </Field>
          <Field label="Email" htmlFor="email" error={errors.email?.message} required>
            <Input type="email" autoComplete="email" {...fieldProps('email')} />
          </Field>
        </div>
        <Field label="University" htmlFor="university" error={errors.university?.message} required>
          <Input autoComplete="organization" {...fieldProps('university')} />
        </Field>
        <Field
          label="Department or programme"
          htmlFor="department"
          error={errors.department?.message}
          required
        >
          <Input {...fieldProps('department')} />
        </Field>
        <Field
          label="Password"
          htmlFor="password"
          error={errors.password?.message}
          hint="At least 8 characters, with a letter and a number."
          required
        >
          <Input type="password" autoComplete="new-password" {...fieldProps('password')} />
        </Field>
        <Field
          label="Confirm password"
          htmlFor="confirmPassword"
          error={errors.confirmPassword?.message}
          required
        >
          <Input type="password" autoComplete="new-password" {...fieldProps('confirmPassword')} />
        </Field>
        <Button type="submit" className="w-full" loading={isSubmitting}>
          Create account
        </Button>
      </form>
    </div>
  );
}
