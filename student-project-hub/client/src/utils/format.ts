import { format, formatDistanceToNowStrict } from 'date-fns';

export function timeAgo(date: string | Date) {
  return formatDistanceToNowStrict(new Date(date), { addSuffix: true });
}

export function formatDate(date: string | Date) {
  return format(new Date(date), 'MMM d, yyyy');
}

export function compactNumber(n: number) {
  return new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');
}

export const STATUS_LABELS = {
  PLANNING: 'Planning',
  ONGOING: 'Ongoing',
  COMPLETED: 'Completed',
} as const;

export const REPORT_REASON_LABELS = {
  SPAM: 'Spam',
  HARASSMENT: 'Harassment or bullying',
  INAPPROPRIATE_CONTENT: 'Inappropriate content',
  PLAGIARISM: 'Plagiarism',
  MISLEADING: 'Misleading information',
  OTHER: 'Something else',
} as const;
