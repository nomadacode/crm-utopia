import { Resend } from "resend";

function recipients() {
  return (process.env.NOTIFY_EMAIL ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function sendNotification(subject: string, html: string) {
  const to = recipients();
  if (to.length === 0) return;
  const resend = new Resend(process.env.RESEND_API_KEY!);
  await resend.emails.send({
    from: process.env.RESEND_FROM ?? "onboarding@resend.dev",
    to,
    subject,
    html,
  });
}
