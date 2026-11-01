import app from "./app";
import { env } from "./config/env";
import { prisma } from "./lib/prisma";
import { startOutboxDispatcher } from "./services/outbox.service";
import { emailQueue } from "./queues/email.queue";

const server = app.listen(env.PORT, () => {
  console.log("--------------------------------");
  console.log("ReachInbox Backend Started");
  console.log(`Environment: ${env.NODE_ENV}`);
  console.log(`Port: ${env.PORT}`);
  console.log("--------------------------------");
});

const stopOutboxDispatcher = startOutboxDispatcher();

async function shutdown(signal: string) {
  console.log(`${signal} received. Shutting down...`);

  stopOutboxDispatcher();

  server.close(async () => {
    try {
      await emailQueue.close();
      await prisma.$disconnect();

      console.log("Database disconnected.");

      process.exit(0);
    } catch (error) {
      console.error("Shutdown error:", error);
      process.exit(1);
    }
  });

  setTimeout(() => {
    console.error("Graceful shutdown timed out.");
    process.exit(1);
  }, 10000).unref();
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));