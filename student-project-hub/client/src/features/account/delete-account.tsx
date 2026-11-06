import { useMutation } from '@tanstack/react-query';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/dialog';
import { Field, Input, Textarea } from '@/components/ui/form-controls';
import { Card } from '@/components/ui/misc';
import { useAuth } from '@/context/auth-context';
import { getErrorMessage } from '@/services/api';
import { userService } from '@/services/user.service';

/**
 * "Delete my account": the student confirms with their password. They are
 * signed out and hidden straight away, and an admin deletes the account for
 * good (or keeps it). Signing in again before then cancels the request.
 */
export function DeleteAccountCard() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [reason, setReason] = useState('');

  const request = useMutation({
    mutationFn: () => userService.requestDeletion(password, reason),
    onSuccess: async () => {
      setOpen(false);
      await logout(); // the server already ended every session
      navigate('/', { replace: true });
      toast.success('Deletion requested. You have been signed out; an admin will confirm soon.', {
        duration: 8000,
      });
    },
  });

  const close = (o: boolean) => {
    if (request.isPending) return;
    setOpen(o);
    if (!o) {
      setPassword('');
      setReason('');
      request.reset();
    }
  };

  return (
    <Card className="border-destructive/30 p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex-1 space-y-1">
          <h2 className="font-semibold text-destructive">Delete account</h2>
          <p className="text-sm text-muted-foreground">
            Ask for your account, projects, comments and likes to be permanently deleted. An admin confirms the
            deletion.
          </p>
        </div>
        <Button variant="outline" className="border-destructive/40 text-destructive hover:bg-destructive/10" onClick={() => setOpen(true)}>
          <Trash2 /> Delete my account
        </Button>
      </div>

      <Dialog open={open} onOpenChange={close}>
        <DialogContent>
          <DialogHeader
            title="Delete your account?"
            description="Here is what happens next."
          />
          <ul className="space-y-2 rounded-lg bg-muted/60 p-3 text-sm">
            <li>You are signed out on every device and your profile is hidden straight away.</li>
            <li>An admin then deletes your account, projects, comments and likes permanently.</li>
            <li>Changed your mind? Sign in before the admin confirms and choose to keep your account.</li>
          </ul>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              request.mutate();
            }}
          >
            <Field
              label="Your password"
              htmlFor="delete-password"
              required
              error={request.isError ? getErrorMessage(request.error) : undefined}
            >
              <Input
                id="delete-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-invalid={request.isError}
                autoFocus
              />
            </Field>
            <Field label="Why are you leaving? (optional)" htmlFor="delete-reason" hint="Only admins see this.">
              <Textarea
                id="delete-reason"
                rows={2}
                maxLength={500}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </Field>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => close(false)} disabled={request.isPending}>
                Cancel
              </Button>
              <Button type="submit" variant="destructive" disabled={!password} loading={request.isPending}>
                <AlertTriangle /> Request deletion
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
