// Gmail SMTP transport for the digest emails.
//
// Requires two env vars on Vercel:
//   GMAIL_USER          the church's Gmail address
//   GMAIL_APP_PASSWORD  a 16-character App Password from that account
//                       (Google Account > Security > 2-Step Verification >
//                       App passwords). A normal account password will not
//                       authenticate over SMTP.
//
// Gmail allows roughly 500 recipients a day on a free account, which is far
// more than a single congregation needs, but it does throttle bursts - hence
// the batching and the sequential sends below.
import nodemailer from "nodemailer";

// Gmail closes idle connections aggressively and a serverless invocation is
// short-lived anyway, so the pool is deliberately small.
let transport = null;

export const isMailConfigured = () =>
  Boolean(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);

export function getTransport() {
  if (transport) return transport;
  if (!isMailConfigured()) {
    throw new Error("GMAIL_USER and GMAIL_APP_PASSWORD are not configured");
  }
  transport = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });
  return transport;
}

/** "UEC Canubing II" <church@gmail.com> — Gmail rewrites the address anyway. */
export const fromAddress = (churchName = "UEC Church") =>
  `"${String(churchName).replace(/"/g, "")}" <${process.env.GMAIL_USER}>`;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const isValidEmail = (value) => EMAIL_PATTERN.test(String(value || "").trim());

/** Gmail's per-message recipient ceiling is 100; stay well under it. */
const BCC_BATCH_SIZE = 50;

/**
 * Sends one message to a list of recipients.
 *
 * Everyone goes in BCC so no member's address is exposed to the rest of the
 * congregation, with the sending account itself in `to` because Gmail rejects
 * a message that has no visible recipient at all.
 *
 * Batches are sent one after another rather than in parallel: Gmail treats a
 * burst of simultaneous SMTP sessions as suspicious, and a digest is never
 * urgent enough to be worth the risk.
 */
export async function sendBulk({ recipients, subject, html, text, churchName }) {
  const clean = [...new Set(recipients.map((r) => String(r || "").trim().toLowerCase()))].filter(
    isValidEmail
  );
  if (!clean.length) return { sent: 0, failed: 0, batches: 0, errors: [] };

  const mailer = getTransport();
  const from = fromAddress(churchName);
  let sent = 0;
  let failed = 0;
  let batches = 0;
  const errors = [];

  for (let i = 0; i < clean.length; i += BCC_BATCH_SIZE) {
    const batch = clean.slice(i, i + BCC_BATCH_SIZE);
    batches += 1;
    try {
      await mailer.sendMail({
        from,
        to: process.env.GMAIL_USER,
        bcc: batch,
        subject,
        text,
        html,
      });
      sent += batch.length;
    } catch (error) {
      // One bad batch should not lose the rest of the congregation's mail
      failed += batch.length;
      errors.push(error.message || String(error));
      console.error("Digest batch failed:", error);
    }
  }

  return { sent, failed, batches, errors };
}

/** A single addressed message — used for the admin's own activity report. */
export async function sendTo({ to, subject, html, text, churchName }) {
  if (!isValidEmail(to)) throw new Error(`Not a valid email address: ${to}`);
  await getTransport().sendMail({
    from: fromAddress(churchName),
    to: String(to).trim(),
    subject,
    text,
    html,
  });
  return { sent: 1, failed: 0, batches: 1, errors: [] };
}
