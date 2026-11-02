import { elasticsearchClient } from "../config/elasticsearch";
import { prisma } from "../lib/prisma";

export const EMAIL_INDEX = "emails";

interface IndexEmailInput {
  id: string;
  recipient: string;
  subject: string;
  body: string;
  status: string;
  senderId: string;
  scheduledAt: Date;
  sentAt: Date | null;
  createdAt: Date;
}

export async function createEmailIndex(): Promise<void> {
  const indexExists = await elasticsearchClient.indices.exists({
    index: EMAIL_INDEX,
  });

  if (indexExists) {
    console.log(`Elasticsearch index "${EMAIL_INDEX}" already exists.`);
    return;
  }

  await elasticsearchClient.indices.create({
    index: EMAIL_INDEX,
    mappings: {
      properties: {
        emailId: { type: "keyword" },
        recipient: { type: "keyword" },
        subject: {
          type: "text",
          fields: {
            keyword: { type: "keyword" },
          },
        },
        body: { type: "text" },
        status: { type: "keyword" },
        senderId: { type: "keyword" },
        scheduledAt: { type: "date" },
        sentAt: { type: "date" },
        createdAt: { type: "date" },
      },
    },
  });

  console.log(`Elasticsearch index "${EMAIL_INDEX}" created successfully.`);
}

export async function indexEmail(
  email: IndexEmailInput
): Promise<void> {
  await elasticsearchClient.index({
    index: EMAIL_INDEX,
    id: email.id,
    document: {
      emailId: email.id,
      recipient: email.recipient,
      subject: email.subject,
      body: email.body,
      status: email.status,
      senderId: email.senderId,
      scheduledAt: email.scheduledAt,
      sentAt: email.sentAt,
      createdAt: email.createdAt,
    },
    refresh: "wait_for",
  });
}

export async function syncEmailToSearch(emailId: string): Promise<void> {
  try {
    const email = await prisma.email.findUnique({
      where: { id: emailId },
    });

    if (!email) {
      console.warn(`Email ${emailId} not found for Elasticsearch indexing.`);
      return;
    }

    await indexEmail({
      id: email.id,
      recipient: email.recipient,
      subject: email.subject,
      body: email.body,
      status: email.status,
      senderId: email.senderId,
      scheduledAt: email.scheduledAt,
      sentAt: email.sentAt,
      createdAt: email.createdAt,
    });

    console.log(`Email ${emailId} synced to Elasticsearch.`);
  } catch (error) {
    console.error(
      `Elasticsearch indexing failed for email ${emailId}:`,
      error
    );
  }
}

export async function backfillEmailsToSearch(): Promise<void> {
  const batchSize = 500;
  let skip = 0;
  let totalIndexed = 0;

  console.log("Starting PostgreSQL to Elasticsearch backfill...");

  while (true) {
    const emails = await prisma.email.findMany({
      orderBy: {
        createdAt: "asc",
      },
      skip,
      take: batchSize,
    });

    if (emails.length === 0) {
      break;
    }

    const operations = emails.flatMap((email) => [
      {
        index: {
          _index: EMAIL_INDEX,
          _id: email.id,
        },
      },
      {
        emailId: email.id,
        recipient: email.recipient,
        subject: email.subject,
        body: email.body,
        status: email.status,
        senderId: email.senderId,
        scheduledAt: email.scheduledAt,
        sentAt: email.sentAt,
        createdAt: email.createdAt,
      },
    ]);

    const result = await elasticsearchClient.bulk({
      operations,
      refresh: false,
    });

    if (result.errors) {
      const failedItems = result.items.filter(
        (item) => item.index?.error
      );

      console.error(
        `${failedItems.length} email documents failed to index.`
      );

      console.error(
        JSON.stringify(failedItems, null, 2)
      );

      throw new Error("Elasticsearch bulk indexing encountered errors.");
    }

    totalIndexed += emails.length;
    skip += emails.length;

    console.log(`Indexed ${totalIndexed} emails so far...`);
  }

  await elasticsearchClient.indices.refresh({
    index: EMAIL_INDEX,
  });

  console.log("--------------------------------");
  console.log("EMAIL BACKFILL COMPLETED");
  console.log(`Total emails indexed: ${totalIndexed}`);
  console.log("--------------------------------");
}