import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { env } from '../src/config/env.js';
import { errorHandler } from '../src/middleware/error-handler.js';
import { MAX_ALERTS_PER_HOUR, reportError } from '../src/services/admin-alerts.service.js';
import { client, signUp } from './helpers.js';

// Capture emails instead of sending them; compose() stays real.
const sent = vi.hoisted(() => ({
  queue: [] as { to: string[]; usernames: string[]; total: number }[],
  errors: [] as { to: string[]; where: string; message: string }[],
  verification: [] as { to: string; token: string }[],
}));
vi.mock('../src/services/email.service.js', async (importOriginal) => {
  const real = await importOriginal<typeof import('../src/services/email.service.js')>();
  return {
    ...real,
    sendVerificationEmail: async (to: string, _n: string, token: string) => {
      sent.verification.push({ to, token });
    },
    sendAccountApprovedEmail: async () => undefined,
    sendPasswordResetEmail: async () => undefined,
    sendApprovalQueueEmail: async (to: string[], students: { username: string }[], total: number) => {
      sent.queue.push({ to, usernames: students.map((s) => s.username), total });
    },
    sendErrorAlertEmail: async (to: string[], alert: { where: string; message: string }) => {
      sent.errors.push({ to, where: alert.where, message: alert.message });
    },
  };
});

const SECRET = 'test-cron-secret-0123456789';

beforeEach(() => {
  sent.queue.length = 0;
  sent.errors.length = 0;
  sent.verification.length = 0;
});

/** Registers a student and clicks the link in their confirmation email. */
async function joinAndConfirm(username: string) {
  await client()
    .post('/api/v1/auth/register')
    .send({
      fullName: `Student ${username}`,
      username,
      email: `${username}@example.edu`,
      password: 'Password123',
      university: 'University of Ghana',
      department: 'Economics',
    })
    .expect(201);
  const { token } = sent.verification.find((m) => m.to === `${username}@example.edu`)!;
  await client().post('/api/v1/auth/verify-email').send({ token }).expect(200);
}

describe('telling admins about students waiting for approval', () => {
  it('emails admins when the first student starts waiting, not for every one', async () => {
    const { user: admin } = await signUp({ role: 'ADMIN', username: 'boss' });
    await signUp({ role: 'ADMIN', username: 'retired', verified: false }); // can't receive email

    await joinAndConfirm('ama');
    expect(sent.queue).toEqual([{ to: [admin.email], usernames: ['ama'], total: 1 }]);

    // The queue already has someone: no second email.
    await joinAndConfirm('kofi');
    expect(sent.queue).toHaveLength(1);
  });

  it('reminds admins every day while anyone is waiting', async () => {
    env.CRON_SECRET = SECRET;
    try {
      const { user: admin } = await signUp({ role: 'ADMIN' });
      const daily = () => client().get('/api/v1/cron/daily').set('Authorization', `Bearer ${SECRET}`);

      // Nobody waiting: no email.
      expect((await daily()).body.data.waitingForApproval).toBe(0);
      expect(sent.queue).toHaveLength(0);

      await signUp({ approved: false, username: 'esi' });
      await signUp({ approved: false, username: 'yaw' });
      await signUp({ username: 'already_in' });
      const res = await daily();
      expect(res.body.data.waitingForApproval).toBe(2);
      expect(sent.queue).toEqual([{ to: [admin.email], usernames: ['esi', 'yaw'], total: 2 }]);
    } finally {
      env.CRON_SECRET = undefined;
    }
  });
});

describe('error alerts', () => {
  function brokenApp(message: string) {
    const app = express();
    app.get('/api/v1/things/:id', () => {
      throw new Error(message);
    });
    app.use(errorHandler);
    return app;
  }

  it('emails admins about a server error, without the ids or request details', async () => {
    const { user: admin } = await signUp({ role: 'ADMIN' });
    const res = await request(brokenApp('Database timed out'))
      .get('/api/v1/things/1b4e28ba-2fa1-41d2-883f-0016d3cca427?secret=abc')
      .expect(500);
    expect(res.body.error).toMatchObject({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
    expect(sent.errors).toEqual([
      { to: [admin.email], where: 'GET /api/v1/things/:id', message: 'Database timed out' },
    ]);
  });

  it('sends one email per kind of error an hour', async () => {
    await signUp({ role: 'ADMIN' });
    const app = brokenApp('Upload failed after 3 tries');
    for (let i = 0; i < 4; i++) await request(app).get(`/api/v1/things/${i}`).expect(500);
    expect(sent.errors).toHaveLength(1);

    // A different problem is still reported.
    await request(brokenApp('Storage bucket missing')).get('/api/v1/things/1').expect(500);
    expect(sent.errors).toHaveLength(2);
  });

  it('never sends more than the hourly cap, whatever happens', async () => {
    await signUp({ role: 'ADMIN' });
    for (let i = 0; i < MAX_ALERTS_PER_HOUR + 5; i++) {
      await reportError(new Error(`Problem kind ${'x'.repeat(i)}`), 'test');
    }
    expect(sent.errors).toHaveLength(MAX_ALERTS_PER_HOUR);
  });

  it('also emails ALERT_EMAIL, and does not alert for normal errors like 404 or 422', async () => {
    const before = env.ALERT_EMAIL;
    env.ALERT_EMAIL = ['ops@example.org'];
    try {
      await client().get('/api/v1/projects/not-a-uuid').expect(422);
      await client().get('/api/v1/nothing-here').expect(404);
      expect(sent.errors).toHaveLength(0);

      await reportError(new Error('Cron job crashed'), 'Daily job');
      expect(sent.errors[0]!.to).toEqual(['ops@example.org']);
    } finally {
      env.ALERT_EMAIL = before;
    }
  });

  it('accepts crash reports from the website, dropping query strings', async () => {
    const { user: admin } = await signUp({ role: 'ADMIN' });
    const res = await client()
      .post('/api/v1/client-errors')
      .send({ message: 'Cannot read properties of undefined', stack: 'at ProjectPage', path: '/reset-password?token=SECRET' });
    expect(res.status).toBe(202);
    expect(sent.errors).toEqual([
      { to: [admin.email], where: 'Website page /reset-password', message: 'Cannot read properties of undefined' },
    ]);
    expect(JSON.stringify(sent.errors)).not.toContain('SECRET');

    await client().post('/api/v1/client-errors').send({ message: '' }).expect(422);
  });
});

describe('email wording', () => {
  it('every email explains why it was sent and has a text version', async () => {
    const { compose } = await vi.importActual<typeof import('../src/services/email.service.js')>(
      '../src/services/email.service.js',
    );
    const { html, text } = compose({
      paragraphs: ['Hi <Ama>,'],
      cta: { label: 'Confirm email', url: 'https://example.com/x' },
      reason: 'You are getting this because you signed up.',
    });
    expect(html).toContain('Hi &lt;Ama&gt;,');
    expect(html).toContain('You are getting this because you signed up.');
    expect(html).toContain('https://example.com/x');
    expect(text).toContain('Confirm email: https://example.com/x');
    expect(text).toContain('You are getting this because you signed up.');
  });
});
