import { prisma } from "../lib/prisma";
import { emailQueue } from "../queues/email.queue";

let running = false;

export async function dispatchPendingOutbox(): Promise<void> {
  if (running) return;

  running = true;

  try {
    const events = await prisma.outboxEvent.findMany({
      where: {
        status: "PENDING",
      },
      orderBy: {
        createdAt: "asc",
      },
      take: 100,
    });

    for (const event of events) {
      try {
        const email = await prisma.email.findUnique({
          where: {
            id: event.emailId,
          },
        });

        if (!email) {
          throw new Error(`Email ${event.emailId} not found`);
        }

        const delay = Math.max(
          0,
          email.scheduledAt.getTime() - Date.now()
        );

        await emailQueue.add(
          "send-email",
          {
            emailId: email.id,
          },
          {
            jobId: email.id,
            delay,
          }
        );

        await prisma.outboxEvent.update({
          where: {
            id: event.id,
          },
          data: {
            status: "DISPATCHED",
            dispatchedAt: new Date(),
            attempts: {
              increment: 1,
            },
            lastError: null,
          },
        });

        console.log(
          `Email ${email.id} published. Delay: ${delay}ms`
        );
      } catch (error) {
        const message =
          error instanceof Error ? error.message : String(error);

        console.error(
          `Outbox dispatch failed for ${event.id}:`,
          message
        );

        await prisma.outboxEvent.update({
          where: {
            id: event.id,
          },
          data: {
            attempts: {
              increment: 1,
            },
            lastError: message,
          },
        }).catch(console.error);
      }
    }
  } catch (error) {
    console.error("Outbox polling failed:", error);
  } finally {
    running = false;
  }
}

export function startOutboxDispatcher() {
  console.log("Outbox dispatcher started.");

  void dispatchPendingOutbox();

  // Event-driven recovery polling, NOT a cron job.
  const timer = setInterval(() => {
    void dispatchPendingOutbox();
  }, 2000);

  return () => clearInterval(timer);
}