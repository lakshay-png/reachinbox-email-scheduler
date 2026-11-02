import { prisma } from "../lib/prisma";
import { sendSlackMessage } from "./slack.service";

interface EmailNotificationDetails {
  recipient: string;
  subject: string;
}

async function sendNotification(
  userId: string,
  message: string
): Promise<void> {
  try {
    const integration = await prisma.slackIntegration.findUnique({
      where: { userId },
      select: { channelId: true },
    });

    if (!integration?.channelId) {
      return;
    }

    await sendSlackMessage(
      userId,
      integration.channelId,
      message
    );
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);

    // Slack failures must never affect email delivery or retries.
    console.error("Slack notification failed:", errorMessage);
  }
}

export async function notifySlackEmailSent(
  userId: string,
  email: EmailNotificationDetails
): Promise<void> {
  const message = [
    ":white_check_mark: *Email delivered successfully*",
    `*To:* ${email.recipient}`,
    `*Subject:* ${email.subject}`,
  ].join("\n");

  await sendNotification(userId, message);
}

export async function notifySlackEmailFailed(
  userId: string,
  email: EmailNotificationDetails,
  error: string
): Promise<void> {
  const message = [
    ":x: *Email delivery permanently failed*",
    `*To:* ${email.recipient}`,
    `*Subject:* ${email.subject}`,
    `*Error:* ${error.slice(0, 500)}`,
  ].join("\n");

  await sendNotification(userId, message);
}
