import { Worker, Job, DelayedError } from "bullmq";

import { redisConnection } from "../config/redis";
import { env } from "../config/env";
import { prisma } from "../lib/prisma";
import { EMAIL_QUEUE_NAME } from "../queues/email.queue";
import { checkAndReserveSendingSlot } from "../services/rate-limit.service";
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
      console.log(`Sender ${email.sender.id} is inactive.`);
      return;
    }

    // 2. Atomically claim the email.
    const claim = await prisma.email.updateMany({
      where: {
        id: emailId,
        status: "SCHEDULED",
      },
      data: {
        status: "PROCESSING",
        attempts: { increment: 1 },
      },
    });

    if (claim.count === 0) {
      console.log(`Email ${emailId} is already claimed or not eligible.`);
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
      // Release the claim if Redis is unavailable.
      await prisma.email.updateMany({
        where: { id: emailId, status: "PROCESSING" },
        data: { status: "SCHEDULED" },
      });

      throw error;
    }

    // 4. Release the claim and reschedule if rate-limited.
    if (!rateLimit.allowed) {
      await prisma.email.updateMany({
        where: {
          id: emailId,
          status: "PROCESSING",
        },
        data: {
          status: "SCHEDULED",
        },
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

    // 5. SMTP delivery will be implemented in Stage 5.
    console.log(
      `Email ${emailId} passed rate limiting and reached the worker.`
    );

    return {
      emailId,
      status: "PROCESSING",
      message: "Waiting for SMTP integration",
    };
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

