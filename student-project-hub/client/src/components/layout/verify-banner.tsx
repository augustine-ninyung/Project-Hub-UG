import { useMutation } from '@tanstack/react-query';
import { MailWarning } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/auth-context';
import { getErrorMessage } from '@/services/api';
import { authService } from '@/services/auth.service';

export function VerifyEmailBanner() {
  const { user } = useAuth();
  const resend = useMutation({
    mutationFn: authService.resendVerification,
    onSuccess: () => toast.success(`Verification email sent to ${user?.email}`),
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  if (!user || user.emailVerified) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-warning/30 bg-warning/10 px-4 py-2 text-sm lg:px-6">
      <MailWarning className="size-4 shrink-0 text-warning" aria-hidden />
      <span className="flex-1">
        Verify your email address to share projects, comment and invite collaborators.
      </span>
      <Button
        variant="link"
        size="sm"
        className="h-auto p-0"
        onClick={() => resend.mutate()}
        loading={resend.isPending}
      >
        Resend email
      </Button>
    </div>
  );
}
