import { Prisma } from "@prisma/client";
import type { Request, Response } from "express";
import { Router } from "express";
import { z } from "zod";

import { prisma } from "../lib/prisma";

const router = Router();

// Validation schema for scheduling an email
const scheduleEmailSchema = z.object({
  senderId: z.string().uuid("Invalid sender ID"),

  recipient: z
    .string()
    .email("Please provide a valid recipient email"),

  subject: z
    .string()
    .min(1, "Subject is required")
    .max(998, "Subject is too long"),

  body: z
    .string()
    .min(1, "Email body cannot be empty"),

  scheduledAt: z
    .string()
    .datetime({
      offset: true,
      message: "scheduledAt must be a valid ISO datetime with timezone",
    }),
});

// POST /api/emails/schedule
// Schedule a new email
router.post(
  "/schedule",
  async (req: Request, res: Response): Promise<void> => {
    try {
      // 1. Validate idempotency key
      const idempotencyKey = req.header("Idempotency-Key");

      if (!idempotencyKey) {
        res.status(400).json({
          success: false,
          message: "Idempotency-Key header is required",
        });
        return;
      }

      if (idempotencyKey.length > 255) {
        res.status(400).json({
          success: false,
          message: "Idempotency-Key must not exceed 255 characters",
        });
        return;
      }

      // 2. Validate request body
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

      const scheduledDate = new Date(scheduledAt);

      // 3. Check whether this request was already processed
      const existingEmail = await prisma.email.findUnique({
        where: {
          idempotencyKey,
        },
        include: {
          sender: true,
        },
      });

      if (existingEmail) {
        res.status(200).json({
          success: true,
          message: "Email was already scheduled",
          duplicate: true,
          data: existingEmail,
        });
        return;
      }

      // 4. Verify that the sender exists and is active
      const sender = await prisma.sender.findUnique({
        where: {
          id: senderId,
        },
      });

      if (!sender || !sender.isActive) {
        res.status(404).json({
          success: false,
          message: "Sender not found or inactive",
        });
        return;
      }

      // 5. Create email and outbox event atomically
      const email = await prisma.$transaction(
        async (tx: Prisma.TransactionClient) => {
          const createdEmail = await tx.email.create({
            data: {
              senderId,
              recipient,
              subject,
              body,
              scheduledAt: scheduledDate,
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

      // 6. Return scheduled email
      res.status(202).json({
        success: true,
        message: "Email scheduled successfully",
        duplicate: false,
        data: email,
      });
    } catch (error: unknown) {
  // Handle duplicate idempotency key
  if (
    error instanceof Error &&
    "code" in error &&
    error.code === "P2002"
  ) {
    try {
      const idempotencyKey = req.header("Idempotency-Key");

      if (idempotencyKey) {
        const existingEmail = await prisma.email.findUnique({
          where: {
            idempotencyKey,
          },
        });

        if (existingEmail) {
          res.status(200).json({
            success: true,
            message: "Email was already scheduled",
            duplicate: true,
            data: existingEmail,
          });
          return;
        }
      }
    } catch (lookupError) {
      console.error("Error retrieving duplicate email:", lookupError);
    }
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

