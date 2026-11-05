import { AsyncLocalStorage } from 'node:async_hooks';
import { createHmac } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env.js';

/**
 * Live updates via Supabase Realtime Broadcast. Clients subscribe to topics
 * with the public anon key; the server sends a bare "changed" ping and the
 * client refetches through the API, so no data travels over Realtime and
 * every read is still authorised by the API.
 *
 * Topics queued during a request are sent once, just before the response is
 * written: by then any transaction has committed, so a client that refetches
 * on the ping sees the new data. Nothing is sent for failed requests.
 */

const outbox = new AsyncLocalStorage<Set<string>>();

export const projectTopic = (projectId: string) => `project:${projectId}`;

/**
 * Per-user topic for notification pings. The name is derived from a server
 * secret, so only the user (who receives it from /auth/me) knows it.
 */
export function userTopic(userId: string) {
  const digest = createHmac('sha256', env.JWT_ACCESS_SECRET).update(`realtime:${userId}`).digest('hex');
  return `user:${digest.slice(0, 32)}`;
}

/** Queues a ping for the current request. Outside a request it is ignored. */
export function queueTopic(topic: string) {
  outbox.getStore()?.add(topic);
}

async function sendBroadcast(topics: string[]) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  try {
    const res = await fetch(`${env.SUPABASE_URL}/realtime/v1/api/broadcast`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: topics.map((topic) => ({ topic, event: 'changed', payload: {} })),
      }),
      signal: AbortSignal.timeout(2000),
    });
    if (!res.ok) console.error(`Realtime broadcast failed: ${res.status}`);
  } catch (err) {
    // Live updates are best-effort; the data itself is already saved.
    console.error('Realtime broadcast failed:', err instanceof Error ? err.message : err);
  }
}

/** Swappable for tests. */
export const realtime = { send: sendBroadcast };

/** Collects topics for each request and flushes them before the response ends. */
export function realtimeOutbox(_req: Request, res: Response, next: NextFunction) {
  const topics = new Set<string>();
  const end = res.end.bind(res) as (...args: unknown[]) => Response;
  res.end = ((...args: unknown[]) => {
    if (topics.size === 0 || res.statusCode >= 400) return end(...args);
    const batch = [...topics];
    topics.clear();
    void realtime.send(batch).finally(() => end(...args));
    return res;
  }) as Response['end'];
  outbox.run(topics, next);
}
