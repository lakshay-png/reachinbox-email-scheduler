import { Prisma } from "@prisma/client";
import type { Request, Response } from "express";
import { Router } from "express";
import { z } from "zod";

import { prisma } from "../lib/prisma";
import { authMiddleware } from "../middleware/auth.middleware";

const router = Router();

router.use(authMiddleware);

const emailListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

router.get(
  "/",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = res.locals.userId as string;
      const validation = emailListQuerySchema.safeParse(req.query);

      if (!validation.success) {
        res.status(400).json({
          success: false,
          message: "Invalid pagination parameters",
          errors: validation.error.flatten(),
        });
        return;
      }

      const { page, limit } = validation.data;

      const where: Prisma.EmailWhereInput = {
        sender: { userId },
      };

      const [emails, total, groupedCounts] = await Promise.all([
        prisma.email.findMany({
          where,
          include: {
            sender: {
              select: {
                id: true,
                email: true,
                displayName: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
          skip: (page - 1) * limit,
          take: limit,
        }),

        prisma.email.count({ where }),

        prisma.email.groupBy({
          by: ["status"],
          where,
          _count: { _all: true },
        }),
      ]);

      const counts = {
        total,
        scheduled: 0,
        processing: 0,
        sent: 0,
        failed: 0,
      };

      for (const group of groupedCounts) {
        counts[group.status.toLowerCase() as
          "scheduled" | "processing" | "sent" | "failed"] =
          group._count._all;
      }

      res.status(200).json({
        success: true,
        data: emails,
        stats: counts,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      console.error("Failed to retrieve emails:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve emails",
      });
    }
  }
);

const scheduleEmailSchema = z.object({
  senderId: z.string().uuid("Invalid sender ID"),
  recipient: z.string().email("Please provide a valid recipient email"),
  subject: z.string().min(1, "Subject is required").max(998),
  body: z.string().min(1, "Email body cannot be empty"),
  scheduledAt: z.string().datetime({
    offset: true,
    message: "scheduledAt must be a valid ISO datetime with timezone",
  }),
});

router.post(
  "/schedule",
  async (req: Request, res: Response): Promise<void> => {
    const userId = res.locals.userId as string;

    try {
      const idempotencyKey = req.header("Idempotency-Key");

      if (!idempotencyKey || idempotencyKey.length > 255) {
        res.status(400).json({
          success: false,
          message: !idempotencyKey
            ? "Idempotency-Key header is required"
            : "Idempotency-Key must not exceed 255 characters",
        });
        return;
      }

      const validation = scheduleEmailSchema.safeParse(req.body);

      if (!validation.success) {
        res.status(400).json({
          success: false,
          message: "Invalid request body",
          errors: validation.error.flatten(),
        });
        return;
      }

      const {
        senderId,
        recipient,
        subject,
        body,
        scheduledAt,
      } = validation.data;

      const existingEmail = await prisma.email.findUnique({
        where: { idempotencyKey },
        include: { sender: true },
      });

      if (existingEmail) {
        if (existingEmail.sender.userId !== userId) {
          res.status(409).json({
            success: false,
            message: "Idempotency key conflict",
          });
          return;
        }

        res.status(200).json({
          success: true,
          message: "Email was already scheduled",
          duplicate: true,
          data: existingEmail,
        });
        return;
      }

      const sender = await prisma.sender.findFirst({
        where: {
          id: senderId,
          userId,
          isActive: true,
        },
      });

      if (!sender) {
        res.status(404).json({
          success: false,
          message: "Sender not found or inactive",
        });
        return;
      }

      const email = await prisma.$transaction(
        async (tx: Prisma.TransactionClient) => {
          const createdEmail = await tx.email.create({
            data: {
              senderId,
              recipient,
              subject,
              body,
              scheduledAt: new Date(scheduledAt),
              idempotencyKey,
              status: "SCHEDULED",
            },
          });

          await tx.outboxEvent.create({
            data: {
              emailId: createdEmail.id,
              status: "PENDING",
            },
          });

          return createdEmail;
        }
      );

      res.status(202).json({
        success: true,
        message: "Email scheduled successfully",
        duplicate: false,
        data: email,
      });
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const existingEmail = await prisma.email.findUnique({
          where: {
            idempotencyKey: req.header("Idempotency-Key")!,
          },
          include: { sender: true },
        });

        if (existingEmail?.sender.userId === userId) {
          res.status(200).json({
            success: true,
            message: "Email was already scheduled",
            duplicate: true,
            data: existingEmail,
          });
          return;
        }

        res.status(409).json({
          success: false,
          message: "Idempotency key conflict",
        });
        return;
      }

      console.error("Error scheduling email:", error);

      res.status(500).json({
        success: false,
        message: "Failed to schedule email",
      });
    }
  }
);

export default router;
