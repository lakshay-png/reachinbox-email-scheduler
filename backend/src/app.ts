import express from "express";
import cors from "cors";
import helmet from "helmet";

import emailRoutes from "./routes/email.routes";
import emailSearchRoutes from "./routes/email-search.routes";
import { prisma } from "./lib/prisma";
import slackRoutes from "./routes/slack.routes";
import { bullBoardRouter } from "./config/bull-board";
import{
  bullBoardAuth,
} from "./config/bull-board";

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// Slack OAuth routes
app.use("/api/slack", slackRoutes);

// Bull Board dashboard
app.use("/admin/queues", bullBoardAuth, bullBoardRouter);

// Health check
app.get("/api/health", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "ReachInbox API is running",
  });
});

// Database health check
app.get("/api/health/db", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;

    res.status(200).json({
      success: true,
      message: "Database connection successful",
    });
  } catch (error) {
    console.error("Database health check failed:", error);

    res.status(500).json({
      success: false,
      message: "Database connection failed",
    });
  }
});

// Email routes
app.use("/api/emails", emailRoutes);
app.use("/api/emails/search", emailSearchRoutes);

export default app;