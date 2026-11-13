import { Hourglass } from 'lucide-react';
import { useAuth } from '@/context/auth-context';

/** Shown to signed-in students until an admin approves their account. */
export function ApprovalBanner() {
  const { user } = useAuth();
  if (!user || user.approved) return null;

  return (
    <div
      role="status"
      className="flex items-center gap-3 border-b border-warning/30 bg-warning/10 px-4 py-2 text-sm lg:px-6"
    >
      <Hourglass className="size-4 shrink-0 text-warning" aria-hidden />
      <span className="flex-1">
        Your account is waiting for an admin's approval. You can look around now. Uploading and commenting
        unlock once you're approved, and we'll email you when that happens.
      </span>
    </div>
  );
}
