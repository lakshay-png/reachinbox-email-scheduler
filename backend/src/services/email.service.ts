
import { mailTransporter } from "../config/mail";
import { env } from "../config/env";

interface SendEmailInput {
  recipient: string;
  subject: string;
  body: string;
}

interface SendEmailResult {
  messageId: string;
  previewUrl: string | false;
}

export async function sendEmail(
  input: SendEmailInput
): Promise<SendEmailResult> {
  if (!env.SMTP_USER || !env.SMTP_PASS) {
    throw new Error("SMTP credentials are missing.");
  }

  const info = await mailTransporter.sendMail({
    from: env.SMTP_FROM,
    to: input.recipient,
    subject: input.subject,
    text: input.body,
  });

  const previewUrl = require("nodemailer").getTestMessageUrl(info);

  return {
    messageId: info.messageId,
    previewUrl: previewUrl || false,
  };
}
