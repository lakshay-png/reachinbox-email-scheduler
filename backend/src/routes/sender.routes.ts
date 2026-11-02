
import { Router, Request, Response } from "express";

import { prisma } from "../lib/prisma";
import { devAuthMiddleware } from "../middleware/dev-auth.middleware";

const router = Router();

router.get(
  "/",
  devAuthMiddleware,
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const userId = res.locals.userId as string;

      const senders = await prisma.sender.findMany({
        where: {
          userId,
          isActive: true,
        },
        select: {
          id: true,
          email: true,
          displayName: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      res.status(200).json({
        success: true,
        data: senders,
      });
    } catch (error) {
      console.error("Failed to retrieve senders:", error);

      res.status(500).json({
        success: false,
        message: "Failed to retrieve sender accounts",
      });
    }
  }
);

export default router;
