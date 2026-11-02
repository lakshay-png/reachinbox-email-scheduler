import { Router, Request, Response } from "express";
import { z } from "zod";

import { elasticsearchClient } from "../config/elasticsearch";
import { EMAIL_INDEX } from "../services/email-index.service";

const router = Router();

interface EmailDocument {
  emailId: string;
  recipient: string;
  subject: string;
  body: string;
  status: string;
  senderId: string;
  scheduledAt: string;
  sentAt: string | null;
  createdAt: string;
}

const searchSchema = z.object({
  q: z.string().optional(),

  status: z.enum([
    "SCHEDULED",
    "PROCESSING",
    "SENT",
    "FAILED",
  ]).optional(),

  senderId: z.string().uuid().optional(),
  recipient: z.string().email().optional(),

  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

router.get(
  "/",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const validation = searchSchema.safeParse(req.query);

      if (!validation.success) {
        res.status(400).json({
          success: false,
          message: "Invalid search parameters",
          errors: validation.error.flatten(),
        });
        return;
      }

      const {
        q,
        status,
        senderId,
        recipient,
        page,
        limit,
      } = validation.data;

      const filters = [];

      if (status) {
        filters.push({
          term: { status },
        });
      }

      if (senderId) {
        filters.push({
          term: { senderId },
        });
      }

      if (recipient) {
        filters.push({
          term: { recipient },
        });
      }

      const must = [];

      if (q && q.trim().length > 0) {
        must.push({
          multi_match: {
            query: q.trim(),
            fields: ["subject^2", "body"],
            type: "best_fields" as const,
          },
        });
      }

      const result = await elasticsearchClient.search<EmailDocument>({
        index: EMAIL_INDEX,
        from: (page - 1) * limit,
        size: limit,

        query: {
          bool: {
            must,
            filter: filters,
          },
        },

        sort: [
          {
            createdAt: {
              order: "desc",
            },
          },
        ],
      });

      const emails = result.hits.hits.map((hit) => ({
        id: hit._id,
        ...hit._source!,
      }));

      const total =
        typeof result.hits.total === "number"
          ? result.hits.total
          : result.hits.total?.value ?? 0;

      res.status(200).json({
        success: true,
        data: emails,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      console.error("Email search failed:", error);

      res.status(500).json({
        success: false,
        message: "Failed to search emails",
      });
    }
  }
);

export default router;