import { Resend } from "resend";
import { serverEnv } from "@/shared/config/env.server";
import { siteConfig } from "@/shared/config/site";

let mail: Resend | undefined;

function getResendClient() {
  if (!serverEnv.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is not configured");
  }

  mail ??= new Resend(serverEnv.RESEND_API_KEY);
  return mail;
}

export default function resendClient() {
  return getResendClient();
}

export function sendEmail({
  to,
  subject,
  html,
  text,
  from,
}: {
  to: string;
  subject: string;
  html: string;
  text: string;
  from?: string;
}) {
  return getResendClient().emails.send({
    from: from || `${siteConfig.email.from.name} <${serverEnv.RESEND_FROM_EMAIL}>`,
    to,
    subject,
    html,
    text,
  });
}
