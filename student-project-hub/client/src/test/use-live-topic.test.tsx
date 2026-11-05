import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useLiveTopic } from '@/hooks/use-live-topic';
import { metaService } from '@/services/project.service';

const handlers = new Map<string, () => void>();
const channel = vi.fn((topic: string) => {
  const ch = {
    on: vi.fn((_type: string, _filter: unknown, cb: () => void) => {
      handlers.set(topic, cb);
      return ch;
    }),
    subscribe: vi.fn(() => ch),
  };
  return ch;
});
const removeChannel = vi.fn(async () => 'ok');

vi.mock('@supabase/realtime-js', () => ({
  RealtimeClient: vi.fn(function RealtimeClient() {
    return { channel, removeChannel };
  }),
}));
vi.mock('@/services/project.service', () => ({
  projectService: {},
  metaService: { realtime: vi.fn() },
}));

function Listener({ topic, onChange }: { topic: string | null; onChange: () => void }) {
  useLiveTopic(topic, onChange);
  return null;
}

const renderListener = (topic: string | null, onChange: () => void) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <Listener topic={topic} onChange={onChange} />
    </QueryClientProvider>,
  );

describe('useLiveTopic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    handlers.clear();
  });

  it('subscribes to the topic and calls back once per burst of pings', async () => {
    vi.mocked(metaService.realtime).mockResolvedValue({ url: 'https://x.supabase.co', anonKey: 'anon' });
    const onChange = vi.fn();
    const { unmount } = renderListener('project:p1', onChange);

    await waitFor(() => expect(channel).toHaveBeenCalledWith('project:p1'));
    vi.useFakeTimers();
    act(() => {
      handlers.get('project:p1')!();
      handlers.get('project:p1')!();
      handlers.get('project:p1')!();
      vi.advanceTimersByTime(300);
    });
    vi.useRealTimers();
    expect(onChange).toHaveBeenCalledTimes(1);

    unmount();
    expect(removeChannel).toHaveBeenCalledTimes(1);
  });

  it('does nothing when live updates are switched off', async () => {
    vi.mocked(metaService.realtime).mockResolvedValue(null);
    renderListener('project:p1', vi.fn());
    await waitFor(() => expect(metaService.realtime).toHaveBeenCalled());
    expect(channel).not.toHaveBeenCalled();
  });

  it('waits for a topic before subscribing', async () => {
    vi.mocked(metaService.realtime).mockResolvedValue({ url: 'https://x.supabase.co', anonKey: 'anon' });
    renderListener(null, vi.fn());
    await waitFor(() => expect(metaService.realtime).toHaveBeenCalled());
    expect(channel).not.toHaveBeenCalled();
  });
});
