import { useQueryClient } from '@tanstack/react-query';
import { useLiveTopic } from '@/hooks/use-live-topic';

/**
 * Keeps project lists live: on a feed ping, the lists on screen (home,
 * explore, landing, profiles) refetch their cards, counts and stats.
 * Lists that aren't on screen just refresh the next time they're shown.
 */
export function LiveFeed() {
  const queryClient = useQueryClient();

  useLiveTopic('projects:feed', () => {
    void queryClient.invalidateQueries({ queryKey: ['projects'] });
    void queryClient.invalidateQueries({ queryKey: ['profile'] });
    void queryClient.invalidateQueries({ queryKey: ['stats'] });
    void queryClient.invalidateQueries({ queryKey: ['categories'] });
    // Admin tables and counts, if an admin has the dashboard open.
    void queryClient.invalidateQueries({ queryKey: ['admin'] });
  });

  return null;
}
