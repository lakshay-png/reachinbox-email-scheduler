
import dotenv from "dotenv";

dotenv.config();

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

  WORKER_CONCURRENCY: Number(
    process.env.WORKER_CONCURRENCY || 5
  ),
};
