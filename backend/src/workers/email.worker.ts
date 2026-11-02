
import { Worker, Job, DelayedError } from "bullmq";
import { syncEmailToSearch } from "../services/email-index.service";

import { redisConnection } from "../config/redis";
import { env } from "../config/env";
import { prisma } from "../lib/prisma";
import { EMAIL_QUEUE_NAME } from "../queues/email.queue";
import { checkAndReserveSendingSlot } from "../services/rate-limit.service";
import { sendEmail } from "../services/email.service";
import {
  notifySlackEmailSent,
  notifySlackEmailFailed,
} from "../services/slack-notification.service";

interface EmailJobData {
  emailId: string;
}

const concurrency = Math.max(1, env.WORKER_CONCURRENCY);

const worker = new Worker<EmailJobData>(
  EMAIL_QUEUE_NAME,
  async (job: Job<EmailJobData>, token?: string) => {
    const { emailId } = job.data;

    console.log(`Processing email: ${emailId}`);

    // 1. Fetch email and sender configuration.
    const email = await prisma.email.findUnique({
      where: { id: emailId },
      include: { sender: true },
    });

    if (!email) {
      console.log(`Email ${emailId} not found.`);
      return;
    }

    if (email.status === "SENT" || email.status === "FAILED") {
      console.log(`Email ${emailId} is already ${email.status}.`);
      return;
    }

    if (!email.sender.isActive) {
  await prisma.email.updateMany({
    where: { id: emailId, status: "SCHEDULED" },
    data: {
      status: "FAILED",
      failedAt: new Date(),
      lastError: "Sender account is inactive.",
    },
  });

  await syncEmailToSearch(emailId);

  await notifySlackEmailFailed(
    email.sender.userId,
    {
      recipient: email.recipient,
      subject: email.subject,
    },
    "Sender account is inactive."
  );

  return;
}

    // 2. Claim the email.
    // PROCESSING is also allowed so BullMQ retries can recover
    // emails left in this state after an interrupted attempt.
    const claim = await prisma.email.updateMany({
      where: {
        id: emailId,
        status: { in: ["SCHEDULED", "PROCESSING"] },
      },
      data: {
        status: "PROCESSING",
      },
    });

    if (claim.count === 0) {
      console.log(`Email ${emailId} is not eligible for processing.`);
      return;
    }

    // 3. Check and reserve the sender's rate-limit slot.
    let rateLimit;

    try {
      rateLimit = await checkAndReserveSendingSlot(
        email.sender.id,
        email.sender.hourlyLimit,
        email.sender.minDelayMs
      );
    } catch (error) {
      await prisma.email.updateMany({
        where: { id: emailId, status: "PROCESSING" },
        data: { status: "SCHEDULED" },
      });

      throw error;
    }

    // 4. Reschedule if the sender is rate-limited.
    if (!rateLimit.allowed) {
      await prisma.email.updateMany({
        where: { id: emailId, status: "PROCESSING" },
        data: { status: "SCHEDULED" },
      });

      const delayMs = Math.max(rateLimit.retryAfterMs, 1000);

      if (!token) {
        throw new Error("BullMQ job lock token is missing.");
      }

      console.log(
        `Email ${emailId} delayed: ${rateLimit.reason}. ` +
        `Retrying in ${delayMs}ms.`
      );

      await job.moveToDelayed(Date.now() + delayMs, token);

      throw new DelayedError();
    }

    // 5. Count the actual sending attempt.
    await prisma.email.update({
      where: { id: emailId },
      data: {
        attempts: { increment: 1 },
      },
    });

    try {
      // 6. Send the actual email through Ethereal SMTP.
      const result = await sendEmail({
        recipient: email.recipient,
        subject: email.subject,
        body: email.body,
      });

      // 7. Mark the email as successfully sent.
      await prisma.email.update({
        where: { id: emailId },
        data: {
          status: "SENT",
          sentAt: new Date(),
          lastError: null,
        },
      });

      await syncEmailToSearch(emailId);

      await notifySlackEmailSent(email.sender.userId, {
       recipient: email.recipient,
      subject: email.subject,
      });

      console.log(`Email ${emailId} sent successfully.`);
      console.log(`Message ID: ${result.messageId}`);

      if (result.previewUrl) {
        console.log(`Ethereal Preview: ${result.previewUrl}`);
      }

      return {
        emailId,
        status: "SENT",
        messageId: result.messageId,
        previewUrl: result.previewUrl,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      const maxAttempts = job.opts.attempts ?? 1;
      const isFinalAttempt = job.attemptsMade + 1 >= maxAttempts;

      // 8. Prepare the email for retry or mark it permanently failed.
      await prisma.email.updateMany({
        where: {
          id: emailId,
          status: "PROCESSING",
        },
        data: {
          status: isFinalAttempt ? "FAILED" : "SCHEDULED",
          lastError: errorMessage,
          ...(isFinalAttempt ? { failedAt: new Date() } : {}),
        },
      });

      await syncEmailToSearch(emailId);

      if (isFinalAttempt) {
       await notifySlackEmailFailed(
        email.sender.userId,
        {
          recipient: email.recipient,
          subject: email.subject,
        },
        errorMessage
      );
    }

    console.error(`Email ${emailId} delivery failed: ${errorMessage}`);

    throw error;
    }
  },
  {
    connection: redisConnection,
    concurrency,
  }
);

worker.on("completed", (job) => {
  console.log(`Job completed: ${job.id}`);
});

worker.on("failed", (job, error) => {
  console.error(`Job failed: ${job?.id}`, error.message);
});

worker.on("error", (error) => {
  console.error("BullMQ worker error:", error);
});

console.log("--------------------------------");
console.log("ReachInbox Email Worker Started");
console.log(`Concurrency: ${concurrency}`);
console.log("--------------------------------");

async function shutdown() {
  console.log("Closing email worker...");

  await worker.close();
  await prisma.$disconnect();

  console.log("Email worker stopped.");
  process.exit(0);
}

process.on("SIGTERM", () => void shutdown());
process.on("SIGINT", () => void shutdown());


