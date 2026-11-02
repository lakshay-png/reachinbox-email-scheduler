import { prisma } from "../lib/prisma";
import { elasticsearchClient } from "../config/elasticsearch";
import { indexEmail } from "../services/email-index.service";

async function main() {
  try {
    console.log("Fetching an email from PostgreSQL...");

    const email = await prisma.email.findFirst({
      orderBy: {
        createdAt: "desc",
      },
    });

    if (!email) {
      throw new Error("No email found in PostgreSQL.");
    }

    console.log("Email found:", email.id);

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

    console.log("EMAIL INDEXED SUCCESSFULLY");

    const result = await elasticsearchClient.get({
      index: "emails",
      id: email.id,
    });

    console.log("Indexed document:");
    console.log(JSON.stringify(result._source, null, 2));

    console.log("EMAIL INDEXING TEST PASSED");
  } catch (error) {
    console.error("EMAIL INDEXING TEST FAILED:", error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
    await elasticsearchClient.close();
  }
}

main();