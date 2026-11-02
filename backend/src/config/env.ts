import dotenv from "dotenv";
import path from "node:path";

dotenv.config({
  path: path.resolve(__dirname, "../../.env"),
});

const requiredEnv = ["DATABASE_URL"] as const;

for (const key of requiredEnv) {
  if (!process.env[key]) {
    throw new Error(`Missing environment variable: ${key}`);
  }
}

export const env = {
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: Number(process.env.PORT || 5000),

  DATABASE_URL: process.env.DATABASE_URL!,

  REDIS_HOST: process.env.REDIS_HOST || "localhost",
  REDIS_PORT: Number(process.env.REDIS_PORT || 6379),

  WORKER_CONCURRENCY: Number(process.env.WORKER_CONCURRENCY || 5),

  SMTP_HOST: process.env.SMTP_HOST || "smtp.ethereal.email",
  SMTP_PORT: Number(process.env.SMTP_PORT || 587),
  SMTP_SECURE: process.env.SMTP_SECURE === "true",
  SMTP_USER: process.env.SMTP_USER || "",
  SMTP_PASS: process.env.SMTP_PASS || "",
  SMTP_FROM:
    process.env.SMTP_FROM ||
    "ReachInbox Scheduler <no-reply@reachinbox.local>",

  ELASTICSEARCH_NODE:
  process.env.ELASTICSEARCH_NODE || "http://localhost:9200",
};

