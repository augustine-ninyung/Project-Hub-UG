import nodemailer, { type Transporter } from 'nodemailer';
import { env, isTest } from '../config/env.js';

let transporter: Transporter | null = null;
if (env.SMTP_HOST) {
  transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
  });
}

interface Mail {
  to: string | string[];
  subject: string;
  text: string;
  html: string;
}

async function send(mail: Mail) {
  if (!transporter) {
    // No SMTP configured: print the email so links can be used in development.
    if (!isTest) {
      console.log(`\n[email] To: ${mail.to}\n   Subject: ${mail.subject}\n   ${mail.text}\n`);
    }
    return;
  }
  try {
    await transporter.sendMail({ from: env.EMAIL_FROM, ...mail });
  } catch (err) {
    // Email failure must not break the request; the user can resend.
    console.error('Failed to send email:', err);
  }
}

export const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

interface Content {
  /** Plain-text paragraphs; escaped for HTML here. */
  paragraphs: string[];
  cta?: { label: string; url: string };
  /** Why the reader got this email, shown small at the bottom. */
  reason: string;
  /** Extra HTML (already escaped) placed after the paragraphs, with its text version. */
  extraHtml?: string;
  extraText?: string;
}

/**
 * Builds both versions of an email. Spam filters trust messages that are
 * plain, personal and explain themselves, so every email has a real text
 * version, a simple button, the full link written out, and a line saying why
 * it was sent. Email clients need inline styles; colours match the site.
 */
export function compose({ paragraphs, cta, reason, extraHtml, extraText }: Content) {
  const button = cta
    ? `<p style="margin:22px 0"><a href="${cta.url}" style="display:inline-block;background:#B5562F;color:#FFFFFF;padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:600">${escapeHtml(cta.label)}</a></p>
<p style="margin:0 0 14px;font-size:13px;color:#6B6A64">Or open this link: <a href="${cta.url}" style="color:#B5562F;word-break:break-all">${cta.url}</a></p>`
    : '';
  const html = `<div style="font-family:system-ui,-apple-system,'Segoe UI',Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px 16px;color:#141413;font-size:15px;line-height:1.6">
<p style="margin:0 0 20px;font-family:Georgia,serif;font-size:18px;font-weight:600">ProjectHub</p>
${paragraphs.map((p) => `<p style="margin:0 0 14px">${escapeHtml(p)}</p>`).join('\n')}
${extraHtml ?? ''}
${button}
<hr style="border:none;border-top:1px solid #E8E6DC;margin:24px 0 12px">
<p style="margin:0;font-size:12px;color:#6B6A64">${escapeHtml(reason)}</p>
</div>`;
  const text = [
    ...paragraphs,
    ...(extraText ? [extraText] : []),
    ...(cta ? [`${cta.label}: ${cta.url}`] : []),
    '--',
    reason,
  ].join('\n\n');
  return { html, text };
}

export async function sendVerificationEmail(to: string, name: string, token: string) {
  const url = `${env.CLIENT_URL}/verify-email?token=${token}`;
  await send({
    to,
    subject: 'Confirm your email for ProjectHub',
    ...compose({
      paragraphs: [
        `Hi ${name},`,
        'Thanks for signing up to ProjectHub. Please confirm this is your email address to finish creating your account. The link works once and expires in 24 hours.',
        'After that, an admin approves new accounts before they can share projects. We will email you when that happens.',
      ],
      cta: { label: 'Confirm email', url },
      reason:
        'You are getting this because someone signed up to ProjectHub with this email address. If it was not you, ignore this email and no account will be activated.',
    }),
  });
}

export async function sendAccountApprovedEmail(to: string, name: string) {
  const url = `${env.CLIENT_URL}/projects/new`;
  await send({
    to,
    subject: 'Your ProjectHub account is approved',
    ...compose({
      paragraphs: [
        `Hi ${name},`,
        'Good news: an admin approved your account. You can now upload projects, comment, and work with other students.',
      ],
      cta: { label: 'Share your first project', url },
      reason: 'You are getting this because you created a ProjectHub account with this email address.',
    }),
  });
}

export async function sendPasswordResetEmail(to: string, name: string, token: string) {
  const url = `${env.CLIENT_URL}/reset-password?token=${token}`;
  await send({
    to,
    subject: 'Reset your ProjectHub password',
    ...compose({
      paragraphs: [
        `Hi ${name},`,
        'We received a request to reset your ProjectHub password. The link expires in 1 hour.',
      ],
      cta: { label: 'Choose a new password', url },
      reason:
        'You are getting this because someone asked to reset the password for this email address. If it was not you, ignore this email: your password stays the same.',
    }),
  });
}

export interface WaitingStudent {
  fullName: string;
  username: string;
  university: string;
}

/** To admins: students who confirmed their email and wait for approval. */
export async function sendApprovalQueueEmail(to: string[], students: WaitingStudent[], total: number) {
  if (to.length === 0 || total === 0) return;
  const url = `${env.CLIENT_URL}/admin/users?approval=pending`;
  const shown = students.slice(0, 10);
  const line = (s: WaitingStudent) => `${s.fullName} (@${s.username}), ${s.university}`;
  const more = total > shown.length ? `and ${total - shown.length} more` : '';
  await send({
    to,
    subject:
      total === 1
        ? 'A student is waiting for approval on ProjectHub'
        : `${total} students are waiting for approval on ProjectHub`,
    ...compose({
      paragraphs: [
        total === 1
          ? 'A student confirmed their email and is waiting for you to approve their account:'
          : `${total} students confirmed their email and are waiting for you to approve their accounts:`,
      ],
      extraHtml: `<ul style="margin:0 0 14px;padding-left:20px">${shown
        .map((s) => `<li>${escapeHtml(line(s))}</li>`)
        .join('')}${more ? `<li>${more}</li>` : ''}</ul>`,
      extraText: [...shown.map((s) => `- ${line(s)}`), ...(more ? [`- ${more}`] : [])].join('\n'),
      cta: { label: 'Review in the admin dashboard', url },
      reason: 'You are getting this because you are a ProjectHub admin.',
    }),
  });
}

export interface ErrorAlert {
  where: string;
  message: string;
  stack?: string;
  at: Date;
}

/** To admins: something broke on the live site. Never includes request data. */
export async function sendErrorAlertEmail(to: string[], alert: ErrorAlert) {
  if (to.length === 0) return;
  const stack = alert.stack?.split('\n').slice(0, 8).join('\n');
  await send({
    to,
    subject: `ProjectHub error: ${alert.message.replace(/\s+/g, ' ').slice(0, 80)}`,
    ...compose({
      paragraphs: [
        `Something went wrong on ProjectHub at ${alert.at.toUTCString()}.`,
        `Where: ${alert.where}`,
        `Error: ${alert.message}`,
        'Similar errors are grouped: you get at most one email per kind of error each hour. The Vercel function logs have the full details.',
      ],
      extraHtml: stack
        ? `<pre style="margin:0 0 14px;padding:12px;background:#F4F3EE;border-radius:6px;font-size:12px;white-space:pre-wrap;word-break:break-all">${escapeHtml(stack)}</pre>`
        : undefined,
      extraText: stack,
      reason: 'You are getting this because you are a ProjectHub admin.',
    }),
  });
}
