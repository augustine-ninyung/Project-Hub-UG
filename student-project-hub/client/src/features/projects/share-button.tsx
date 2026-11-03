import { Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

/** Uses the native share sheet when available, otherwise copies the link. */
export function ShareButton({ title, url }: { title: string; url: string }) {
  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch (err) {
        if ((err as DOMException).name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Link copied to clipboard');
    } catch {
      toast.error('Could not copy the link');
    }
  };

  return (
    <Button variant="outline" onClick={share}>
      <Share2 /> Share
    </Button>
  );
}
