import { Router } from "express";
import { prisma } from "../lib/prisma";

const router = Router();

router.get("/", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "ReachInbox API is running",
    timestamp: new Date().toISOString(),
  });
});

router.get("/db", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;

    res.status(200).json({
      success: true,
      database: "connected",
    });
  } catch (error) {
    console.error("Database health check failed:", error);

    res.status(503).json({
      success: false,
      database: "disconnected",
    });
  }
});

export default router;