import { RealtimeClient } from '@supabase/realtime-js';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { metaService, type RealtimeConfig } from '@/services/project.service';

let client: RealtimeClient | null = null;

function getClient({ url, anonKey }: RealtimeConfig) {
  client ??= new RealtimeClient(`${url.replace(/^http/, 'ws')}/realtime/v1`, {
    params: { apikey: anonKey },
  });
  return client;
}

/**
 * Calls `onChange` (debounced) whenever the server pings `topic`. Pings carry
 * no data: the caller refetches through the API. Does nothing when live
 * updates aren't configured. Subscribe to each topic from one component only.
 */
export function useLiveTopic(topic: string | null | undefined, onChange: () => void) {
  const { data: config } = useQuery({
    queryKey: ['realtime-config'],
    queryFn: metaService.realtime,
    staleTime: Infinity,
    retry: false,
  });

  const handler = useRef(onChange);
  useEffect(() => {
    handler.current = onChange;
  });

  useEffect(() => {
    if (!config || !topic) return;
    const realtime = getClient(config);
    const channel = realtime.channel(topic);
    let timer: ReturnType<typeof setTimeout> | undefined;

    channel
      .on('broadcast', { event: 'changed' }, () => {
        clearTimeout(timer);
        timer = setTimeout(() => handler.current(), 250);
      })
      .subscribe();

    return () => {
      clearTimeout(timer);
      void realtime.removeChannel(channel);
    };
  }, [config, topic]);
}
