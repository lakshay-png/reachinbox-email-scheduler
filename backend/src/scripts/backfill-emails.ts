import { prisma } from "../lib/prisma";
import { elasticsearchClient } from "../config/elasticsearch";
import { backfillEmailsToSearch } from "../services/email-index.service";

async function main(): Promise<void> {
  try {
    await backfillEmailsToSearch();

    const postgresCount = await prisma.email.count();

    const elasticsearchCount = await elasticsearchClient.count({
      index: "emails",
    });

    console.log("--------------------------------");
    console.log("BACKFILL VERIFICATION");
    console.log(`PostgreSQL emails: ${postgresCount}`);
    console.log(`Elasticsearch documents: ${elasticsearchCount.count}`);
    console.log("--------------------------------");

    if (postgresCount !== elasticsearchCount.count) {
      throw new Error("PostgreSQL and Elasticsearch counts do not match.");
    }

    console.log("BACKFILL VERIFICATION PASSED");
  } finally {
    await prisma.$disconnect();
    await elasticsearchClient.close();
  }
}

main().catch((error) => {
  console.error("Backfill failed:", error);
  process.exitCode = 1;
});