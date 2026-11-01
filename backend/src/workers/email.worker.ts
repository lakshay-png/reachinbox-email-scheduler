import { Worker, Job } from "bullmq";

import { redisConnection } from "../config/redis";
import { env } from "../config/env";
import { prisma } from "../lib/prisma";
import { EMAIL_QUEUE_NAME } from "../queues/email.queue";

interface EmailJobData {
  emailId: string;
}

const concurrency = Math.max(1, env.WORKER_CONCURRENCY);

const worker = new Worker<EmailJobData>(
  EMAIL_QUEUE_NAME,

  async (job: Job<EmailJobData>) => {
    const { emailId } = job.data;

    console.log(`Processing email: ${emailId}`);

    const result = await prisma.email.updateMany({
      where: {
        id: emailId,
        status: {
          in: ["SCHEDULED", "PROCESSING"],
        },
      },
      data: {
        status: "PROCESSING",
        attempts: {
          increment: 1,
        },
      },
    });

    if (result.count === 0) {
      console.log(`Email ${emailId} is no longer eligible.`);
      return;
    }

    /*
     * TEMPORARY STAGE 3 IMPLEMENTATION
     *
     * Actual SMTP delivery will be integrated in Stage 5.
     *
     * For now, the worker marks the email as PROCESSING
     * and completes the queue job.
     */

    console.log(
      `Email ${emailId} reached the worker successfully.`
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