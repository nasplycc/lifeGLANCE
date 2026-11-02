// Email utility — sends verification codes via SMTP
// Configure via environment variables:
//   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM

import nodemailer from 'nodemailer';

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '465', 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    console.warn('[email] SMTP not configured — emails will be logged to console only');
    return null;
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  return transporter;
}

export async function sendVerificationEmail(to, code) {
  const from = process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@timora.local';
  const subject = '【时光墙】邮箱验证码';
  const html = `
    <div style="font-family: 'Courier New', monospace; max-width: 400px; margin: 0 auto; padding: 24px; background: #0F1117; color: #E8E0D0; border-radius: 8px;">
      <h2 style="color: #C8A96E; margin: 0 0 16px;">时光墙 验证码</h2>
      <p style="margin: 0 0 12px; color: rgba(232,224,208,0.7);">你的验证码是：</p>
      <div style="font-size: 32px; letter-spacing: 8px; color: #38B2AC; text-align: center; padding: 16px; background: rgba(56,178,172,0.1); border-radius: 4px; margin: 0 0 16px;">
        ${code}
      </div>
      <p style="margin: 0; font-size: 12px; color: rgba(232,224,208,0.4);">验证码 10 分钟内有效。如非本人操作，请忽略此邮件。</p>
    </div>
  `;

  const transport = getTransporter();
  if (!transport) {
    console.log(`[email] (dev) Verification code for ${to}: ${code}`);
    return { ok: true, dev: true };
  }

  try {
    await transport.sendMail({ from, to, subject, html });
    console.log(`[email] Verification code sent to ${to}`);
    console.log(`[email] (dev) Verification code for ${to}: ${code}`);
    return { ok: true };
  } catch (err) {
    console.error('[email] Send failed:', err.message);
    console.log(`[email] (fallback) Verification code for ${to}: ${code}`);
    return { ok: true, fallback: true };
  }
}

export function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}
