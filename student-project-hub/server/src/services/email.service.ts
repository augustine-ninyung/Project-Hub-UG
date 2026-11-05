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

// Email clients need inline styles; colours match the site's clay-on-ivory theme.
function layout(heading: string, body: string, ctaLabel: string, ctaUrl: string) {
  return `<div style="background:#FAF9F5;padding:32px 16px">
<div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;max-width:480px;margin:auto;padding:32px;background:#FFFFFF;border:1px solid #E8E6DC;border-radius:12px;color:#141413">
  <p style="margin:0 0 24px;font-family:Georgia,serif;font-size:20px;font-weight:600">ProjectHub</p>
  <h2 style="margin:0 0 16px;font-family:Georgia,serif;font-weight:500;font-size:24px">${heading}</h2>
  <p style="line-height:1.6;margin:0">${body}</p>
  <p style="margin:28px 0"><a href="${ctaUrl}" style="background:#B5562F;color:#FFFFFF;padding:11px 20px;border-radius:8px;text-decoration:none;font-weight:600">${ctaLabel}</a></p>
  <p style="font-size:12px;color:#6B6A64;margin:0">If the button does not work, copy this link:<br>${ctaUrl}</p>
</div>
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
