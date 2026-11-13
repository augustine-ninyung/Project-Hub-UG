import { useMutation } from '@tanstack/react-query';
import { MailCheck } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { getErrorMessage } from '@/services/api';
import { authService } from '@/services/auth.service';

/**
 * "Check your inbox" panel with a resend button, shown after sign-up and when
 * someone tries to sign in before confirming their email.
 */
export function CheckEmail({
  identifier,
  email,
  title = 'Check your email',
  children,
}: {
  /** Email or username, used to resend the link. */
  identifier: string;
  /** Shown to the student when known. */
  email?: string;
  title?: string;
  children?: React.ReactNode;
}) {
  const [sent, setSent] = useState(false);
  const resend = useMutation({
    mutationFn: () => authService.resendVerification(identifier),
    onSuccess: () => setSent(true),
  });

  return (
    <div role="status" className="space-y-3 rounded-lg border bg-muted/40 p-4 text-sm animate-fade-in">
      <div className="flex items-start gap-3">
        <MailCheck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
        <div className="space-y-1.5">
          <p className="font-medium">{title}</p>
          <p className="text-muted-foreground">
            We sent a confirmation link to {email ? <strong className="text-foreground">{email}</strong> : 'your email'}.
            Click it to finish creating your account. It can take a minute, so check your spam folder too.
          </p>
          {children}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3 pl-8">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => resend.mutate()}
          loading={resend.isPending}
          disabled={sent}
        >
          {sent ? 'New link sent' : 'Send a new link'}
        </Button>
        {resend.isError && <span className="text-destructive">{getErrorMessage(resend.error)}</span>}
      </div>
    </div>
  );
}
