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
  to: string;
  subject: string;
  text: string;
  html: string;
}

async function send(mail: Mail) {
  if (!transporter) {
    // No SMTP configured: print the email so links can be used in development.
    if (!isTest) {
      console.log(`\n📧 Email to ${mail.to}\n   Subject: ${mail.subject}\n   ${mail.text}\n`);
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

function layout(heading: string, body: string, ctaLabel: string, ctaUrl: string) {
  return `<div style="font-family:system-ui,sans-serif;max-width:480px;margin:auto;padding:24px;color:#18181b">
  <h2 style="margin:0 0 16px">${heading}</h2>
  <p style="line-height:1.6">${body}</p>
  <p style="margin:24px 0"><a href="${ctaUrl}" style="background:#0f766e;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none">${ctaLabel}</a></p>
  <p style="font-size:12px;color:#71717a">If the button does not work, copy this link:<br>${ctaUrl}</p>
</div>`;
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export async function sendVerificationEmail(to: string, name: string, token: string) {
  const url = `${env.CLIENT_URL}/verify-email?token=${token}`;
  await send({
    to,
    subject: 'Verify your email — Student Project Hub',
    text: `Hi ${name}, confirm your email address: ${url}`,
    html: layout(
      `Welcome, ${escapeHtml(name)}!`,
      'Confirm your email address to start sharing projects with the community. This link expires in 24 hours.',
      'Verify email',
      url,
    ),
  });
}

export async function sendPasswordResetEmail(to: string, name: string, token: string) {
  const url = `${env.CLIENT_URL}/reset-password?token=${token}`;
  await send({
    to,
    subject: 'Reset your password — Student Project Hub',
    text: `Hi ${name}, reset your password: ${url} (expires in 1 hour)`,
    html: layout(
      'Reset your password',
      `Hi ${escapeHtml(name)}, we received a request to reset your password. This link expires in 1 hour. If you did not request this, you can ignore this email.`,
      'Reset password',
      url,
    ),
  });
}
