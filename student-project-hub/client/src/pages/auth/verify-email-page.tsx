import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { AUTH_QUERY_KEY, useAuth } from '@/context/auth-context';
import { getErrorMessage } from '@/services/api';
import { authService } from '@/services/auth.service';
import type { SelfUser } from '@/types/api';

export default function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuth();
  const started = useRef(false);

  const verify = useMutation({
    mutationFn: authService.verifyEmail,
    onSuccess: () => {
      // Update the cached session if this browser is signed in as that user.
      queryClient.setQueryData<SelfUser | null>(AUTH_QUERY_KEY, (u) =>
        u ? { ...u, emailVerified: true } : u,
      );
    },
  });

  useEffect(() => {
    // Tokens are single-use: guard against StrictMode's double effect.
    if (token && !started.current) {
      started.current = true;
      verify.mutate(token);
    }
  }, [token, verify]);

  if (!token || verify.isError) {
    return (
      <div className="space-y-4 text-center">
        <XCircle className="mx-auto size-10 text-destructive" aria-hidden />
        <h1 className="text-2xl font-semibold tracking-tight">Verification failed</h1>
        <p className="text-sm text-muted-foreground">
          {token ? getErrorMessage(verify.error) : 'This link is missing its token.'} Links work once
          and expire after 24 hours. Try signing in: if your email still needs confirming, you can get a new link
          there.
        </p>
        <Button asChild variant="outline">
          <Link to="/login">Go to sign in</Link>
        </Button>
      </div>
    );
  }

  if (verify.isSuccess) {
    return (
      <div className="space-y-4 text-center">
        <CheckCircle2 className="mx-auto size-10 text-success" aria-hidden />
        <h1 className="text-2xl font-semibold tracking-tight">Email confirmed</h1>
        <p className="text-sm text-muted-foreground">
          Thanks! You can sign in and look around now. An admin will approve your account so you can upload
          projects and comment, and we'll email you when they do.
        </p>
        <Button asChild>
          {isAuthenticated ? <Link to="/">Continue</Link> : <Link to="/login">Sign in</Link>}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 text-center" role="status">
      <Loader2 className="size-8 animate-spin text-muted-foreground" aria-hidden />
      <p className="text-sm text-muted-foreground">Confirming your email…</p>
    </div>
  );
}
