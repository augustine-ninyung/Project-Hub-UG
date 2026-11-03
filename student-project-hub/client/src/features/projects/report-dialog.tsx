import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { FormAlert } from '@/components/common/form-alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/dialog';
import { Field, Textarea } from '@/components/ui/form-controls';
import { getErrorMessage } from '@/services/api';
import { reportService } from '@/services/user.service';
import type { ReportReason } from '@/types/api';
import { cn } from '@/utils/cn';
import { REPORT_REASON_LABELS } from '@/utils/format';

interface ReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetType: 'PROJECT' | 'COMMENT';
  targetId: string;
}

export function ReportDialog({ open, onOpenChange, targetType, targetId }: ReportDialogProps) {
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');

  const mutation = useMutation({
    mutationFn: () =>
      reportService.create({ targetType, targetId, reason: reason!, details: details || undefined }),
    onSuccess: () => {
      toast.success('Thanks — our moderators will review this report.');
      onOpenChange(false);
      setReason(null);
      setDetails('');
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader
          title={`Report ${targetType === 'PROJECT' ? 'project' : 'comment'}`}
          description="Reports are anonymous to the author and reviewed by administrators."
        />
        <fieldset className="space-y-2">
          <legend className="mb-2 text-sm font-medium">Why are you reporting this?</legend>
          {(Object.keys(REPORT_REASON_LABELS) as ReportReason[]).map((r) => (
            <label
              key={r}
              className={cn(
                'flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2 text-sm transition-colors hover:bg-accent',
                reason === r && 'border-primary bg-primary/5',
              )}
            >
              <input
                type="radio"
                name="reason"
                value={r}
                checked={reason === r}
                onChange={() => setReason(r)}
                className="accent-[var(--primary)]"
              />
              {REPORT_REASON_LABELS[r]}
            </label>
          ))}
        </fieldset>
        <Field label="Additional details (optional)" htmlFor="report-details">
          <Textarea
            id="report-details"
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            maxLength={1000}
            rows={3}
          />
        </Field>
        {mutation.isError && <FormAlert>{getErrorMessage(mutation.error)}</FormAlert>}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={!reason}
            loading={mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            Submit report
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
