import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '../src/config/prisma.js';
import { client, createCategory, PASSWORD, signUp } from './helpers.js';

// Capture the emails instead of sending them, so the test can follow the real links.
const mail = vi.hoisted(() => ({
  verification: [] as { to: string; token: string }[],
  approved: [] as string[],
}));
vi.mock('../src/services/email.service.js', () => ({
  sendVerificationEmail: async (to: string, _name: string, token: string) => {
    mail.verification.push({ to, token });
  },
  sendAccountApprovedEmail: async (to: string) => {
    mail.approved.push(to);
  },
  sendPasswordResetEmail: async () => undefined,
}));

beforeEach(() => {
  mail.verification.length = 0;
  mail.approved.length = 0;
});

const registration = {
  fullName: 'Kofi Boateng',
  username: 'kofi_b',
  email: 'kofi@example.edu',
  password: PASSWORD,
  university: 'University of Ghana',
  department: 'Economics',
};

const postProject = (agent: ReturnType<typeof client>, categoryId: string) =>
  agent.post('/api/v1/projects').field(
    'data',
    JSON.stringify({
      title: 'Campus market survey',
      description: 'What students spend on food each week, by hall.',
      categoryId,
      technologies: ['Excel'],
    }),
  );

describe('sign-up: confirm email, then admin approval', () => {
  it('walks a new student through the whole journey', async () => {
    const category = await createCategory();
    const { agent: admin, user: adminUser } = await signUp({ role: 'ADMIN' });
    const student = client();
    const signIn = () =>
      student.post('/api/v1/auth/login').send({ identifier: registration.email, password: PASSWORD });
    mail.verification.length = 0; // the admin's own sign-up email

    // 1. Sign up: a confirmation email goes out, nobody is signed in.
    expect((await student.post('/api/v1/auth/register').send(registration)).status).toBe(201);
    expect(mail.verification).toHaveLength(1);
    expect(mail.verification[0]!.to).toBe(registration.email);
    const id = (await prisma.user.findUniqueOrThrow({ where: { email: registration.email } })).id;

    // 2. Can't sign in before confirming; the admin can't approve yet either.
    const early = await signIn();
    expect(early.status).toBe(403);
    expect(early.body.error.code).toBe('EMAIL_NOT_VERIFIED');
    expect((await admin.post(`/api/v1/admin/users/${id}/approve`)).status).toBe(409);

    // 3. Click the link in the email, then sign in.
    expect(
      (await client().post('/api/v1/auth/verify-email').send({ token: mail.verification[0]!.token })).status,
    ).toBe(200);
    const login = await signIn();
    expect(login.status).toBe(200);
    expect(login.body.data.user).toMatchObject({ emailVerified: true, approved: false });

    // 4. Signed in but not approved: can browse, can't upload.
    expect((await student.get('/api/v1/projects')).status).toBe(200);
    expect((await postProject(student, category.id)).body.error.code).toBe('ACCOUNT_NOT_APPROVED');

    // 5. The admin sees them waiting and approves.
    const stats = await admin.get('/api/v1/admin/statistics?fresh=1');
    expect(stats.body.data.totals.awaitingApproval).toBe(1);
    const queue = await admin.get('/api/v1/admin/users?approval=pending');
    expect(queue.body.data.map((u: { id: string }) => u.id)).toEqual([id]);

    const approved = await admin.post(`/api/v1/admin/users/${id}/approve`);
    expect(approved.status).toBe(200);
    expect(approved.body.data.approvedAt).toBeTruthy();
    expect(mail.approved).toEqual([registration.email]);
    const note = await prisma.notification.findFirstOrThrow({ where: { recipientId: id } });
    expect(note).toMatchObject({ type: 'ACCOUNT_APPROVED', actorId: adminUser.id });

    // 6. Works on their current session, no need to sign in again.
    expect((await student.get('/api/v1/auth/me')).body.data.user.approved).toBe(true);
    expect((await postProject(student, category.id)).status).toBe(201);
    expect((await admin.post(`/api/v1/admin/users/${id}/approve`)).status).toBe(409);
    expect((await admin.get('/api/v1/admin/users?approval=pending')).body.data).toHaveLength(0);
  });

  it('resends the confirmation link without revealing who has an account', async () => {
    await client().post('/api/v1/auth/register').send(registration);
    mail.verification.length = 0;

    const known = await client().post('/api/v1/auth/resend-verification').send({ identifier: registration.email });
    const unknown = await client().post('/api/v1/auth/resend-verification').send({ identifier: 'nobody@example.edu' });
    expect(known.status).toBe(200);
    expect(unknown.status).toBe(200);
    expect(known.body).toEqual(unknown.body);
    expect(mail.verification.map((m) => m.to)).toEqual([registration.email]);

    // The username works too, as on the sign-in form.
    await client().post('/api/v1/auth/resend-verification').send({ identifier: registration.username });
    expect(mail.verification).toHaveLength(2);

    // Only the newest link works.
    const first = await prisma.authToken.count({ where: { type: 'EMAIL_VERIFICATION', usedAt: null } });
    expect(first).toBe(1);

    // Nothing is sent once confirmed.
    await prisma.user.update({ where: { email: registration.email }, data: { emailVerifiedAt: new Date() } });
    await client().post('/api/v1/auth/resend-verification').send({ identifier: registration.email });
    expect(mail.verification).toHaveLength(2);
  });

  it('signs out a session whose email is no longer confirmed', async () => {
    const { agent, user } = await signUp();
    await prisma.user.update({ where: { id: user.id }, data: { emailVerifiedAt: null } });
    expect((await agent.get('/api/v1/auth/me')).status).toBe(401);
    expect((await agent.post('/api/v1/auth/refresh')).status).toBe(401);
  });

  it('lets admins upload without approving themselves', async () => {
    const category = await createCategory();
    const { agent } = await signUp({ role: 'ADMIN', approved: false });
    expect((await postProject(agent, category.id)).status).toBe(201);
  });

  it('only admins can approve', async () => {
    const { agent: student } = await signUp();
    const { user } = await signUp({ approved: false });
    expect((await student.post(`/api/v1/admin/users/${user.id}/approve`)).status).toBe(403);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).approvedAt).toBeNull();
  });
});
