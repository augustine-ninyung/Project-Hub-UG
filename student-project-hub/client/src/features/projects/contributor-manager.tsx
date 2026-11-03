import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/form-controls';
import { Badge, Card, UserAvatar } from '@/components/ui/misc';
import { UserPicker } from '@/features/users/user-picker';
import { getErrorMessage } from '@/services/api';
import { projectService } from '@/services/project.service';
import type { ProjectDetail, UserSummary } from '@/types/api';
import { projectKeys } from './hooks';

const STATUS_BADGE = {
  PENDING: { label: 'Invited', variant: 'secondary' },
  ACCEPTED: { label: 'Contributor', variant: 'success' },
  DECLINED: { label: 'Declined', variant: 'destructive' },
} as const;

/** Live contributor management on the edit page (each action hits the API). */
export function ContributorManager({ project }: { project: ProjectDetail }) {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<UserSummary | null>(null);
  const [role, setRole] = useState('');

  const refresh = () => queryClient.invalidateQueries({ queryKey: projectKeys.detail(project.id) });

  const invite = useMutation({
    mutationFn: () => projectService.inviteContributor(project.id, selected!.username, role),
    onSuccess: () => {
      toast.success(`Invitation sent to ${selected!.fullName}`);
      setSelected(null);
      setRole('');
      refresh();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const remove = useMutation({
    mutationFn: (userId: string) => projectService.removeContributor(project.id, userId),
    onSuccess: () => {
      toast.success('Contributor removed');
      refresh();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  return (
    <Card className="space-y-4 p-5 sm:p-6">
      <div>
        <h2 className="font-semibold">Contributors</h2>
        <p className="text-sm text-muted-foreground">
          Invitations are sent immediately. Students appear on the project once they accept.
        </p>
      </div>

      {selected ? (
        <div className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center">
          <span className="flex min-w-0 flex-1 items-center gap-3">
            <UserAvatar user={selected} size="sm" />
            <span className="truncate text-sm font-medium">{selected.fullName}</span>
          </span>
          <Input
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder="Role (optional)"
            maxLength={60}
            className="sm:w-44"
            aria-label="Contributor role"
          />
          <div className="flex gap-2">
            <Button onClick={() => invite.mutate()} loading={invite.isPending}>
              Send invite
            </Button>
            <Button variant="ghost" onClick={() => setSelected(null)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <UserPicker
          onSelect={setSelected}
          excludeIds={[
            project.ownerId,
            ...project.contributors.filter((c) => c.status !== 'DECLINED').map((c) => c.user.id),
          ]}
        />
      )}

      {project.contributors.length > 0 && (
        <ul className="divide-y rounded-lg border">
          {project.contributors.map((c) => (
            <li key={c.id} className="flex items-center gap-3 p-3">
              <UserAvatar user={c.user} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{c.user.fullName}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  @{c.user.username}
                  {c.role && ` · ${c.role}`}
                </span>
              </span>
              <Badge variant={STATUS_BADGE[c.status].variant}>{STATUS_BADGE[c.status].label}</Badge>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => remove.mutate(c.user.id)}
                disabled={remove.isPending}
                aria-label={`Remove ${c.user.fullName}`}
              >
                <X />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
