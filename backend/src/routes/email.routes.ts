import { Prisma } from "@prisma/client";
import type { Request, Response } from "express";
import { Router } from "express";
import { z } from "zod";
import { createHash } from "crypto";

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


const bulkScheduleEmailSchema = z.object({
  senderId: z.string().uuid("Invalid sender ID"),
  subject: z.string().min(1, "Subject is required").max(998),
  body: z.string().min(1, "Email body cannot be empty"),
  scheduledAt: z.string().datetime({
    offset: true,
    message: "scheduledAt must be a valid ISO datetime with timezone",
  }),
  leads: z
    .array(
      z.object({
        name: z.string().max(255).optional().default(""),
        email: z.string().email("Invalid recipient email"),
      })
    )
    .min(1, "At least one lead is required")
    .max(500, "A maximum of 500 leads can be scheduled per request")
    .superRefine((leads, ctx) => {
      const seen = new Set<string>();

      leads.forEach((lead, index) => {
        const email = lead.email.trim().toLowerCase();

        if (seen.has(email)) {
          ctx.addIssue({
            code: "custom",
            path: [index, "email"],
            message: "Duplicate email address in batch",
          });
        }

        seen.add(email);
      });
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


router.post(
  "/bulk-schedule",
  async (req: Request, res: Response): Promise<void> => {
    const userId = res.locals.userId as string;

    try {
      const batchKey = req.header("Idempotency-Key");

      if (!batchKey || batchKey.length > 190) {
        res.status(400).json({
          success: false,
          message: !batchKey
            ? "Idempotency-Key header is required"
            : "Idempotency-Key must not exceed 190 characters",
        });
        return;
      }

      const validation = bulkScheduleEmailSchema.safeParse(req.body);

      if (!validation.success) {
        res.status(400).json({
          success: false,
          message: "Invalid bulk scheduling request",
          errors: validation.error.flatten(),
        });
        return;
      }

      const {
        senderId,
        subject,
        body,
        scheduledAt,
        leads,
      } = validation.data;

      // Verify that the sender belongs to this user and is active.
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

      const normalizedLeads = leads.map((lead) => ({
        name: lead.name.trim(),
        email: lead.email.trim().toLowerCase(),
      }));

      // Generate a stable idempotency key for each recipient.
      const idempotencyKeys = normalizedLeads.map((lead) => {
        const emailHash = createHash("sha256")
          .update(lead.email)
          .digest("hex");

        return `${batchKey}:${emailHash}`;
      });

      const existingEmails = await prisma.email.findMany({
        where: {
          idempotencyKey: {
            in: idempotencyKeys,
          },
        },
        include: {
          sender: {
            select: {
              userId: true,
            },
          },
        },
      });

      if (existingEmails.length > 0) {
        const belongsToUser = existingEmails.every(
          (email) => email.sender.userId === userId
        );

        if (!belongsToUser) {
          res.status(409).json({
            success: false,
            message: "Idempotency key conflict",
          });
          return;
        }

        if (existingEmails.length !== normalizedLeads.length) {
          res.status(409).json({
            success: false,
            message:
              "This batch key was previously used with a different set of leads.",
          });
          return;
        }

        res.status(200).json({
          success: true,
          message: "Bulk email batch was already scheduled",
          duplicate: true,
          scheduledCount: existingEmails.length,
          data: existingEmails,
        });
        return;
      }

      // Create all emails and outbox events atomically.
      const createdEmails = await prisma.$transaction(
        async (tx: Prisma.TransactionClient) => {
          const created = [];

          for (let index = 0; index < normalizedLeads.length; index++) {
            const lead = normalizedLeads[index];

            const email = await tx.email.create({
              data: {
                senderId,
                recipient: lead.email,
                subject,
                body,
                scheduledAt: new Date(scheduledAt),
                idempotencyKey: idempotencyKeys[index],
                status: "SCHEDULED",
              },
            });

            await tx.outboxEvent.create({
              data: {
                emailId: email.id,
                status: "PENDING",
              },
            });

            created.push(email);
          }

          return created;
        }
      );

      res.status(202).json({
        success: true,
        message: "Bulk emails scheduled successfully",
        duplicate: false,
        scheduledCount: createdEmails.length,
        data: createdEmails,
      });
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        res.status(409).json({
          success: false,
          message:
            "A scheduling conflict occurred. Retry using the same Idempotency-Key.",
        });
        return;
      }

      console.error("Error scheduling bulk emails:", error);

      res.status(500).json({
        success: false,
        message: "Failed to schedule bulk emails",
      });
    }
  }
);


export default router;
