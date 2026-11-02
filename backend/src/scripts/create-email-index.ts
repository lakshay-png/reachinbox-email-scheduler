import { createEmailIndex } from "../services/email-index.service";
import { elasticsearchClient } from "../config/elasticsearch";

async function main() {
  try {
    console.log("Creating Elasticsearch email index...");

    await createEmailIndex();

    const result = await elasticsearchClient.indices.get({
      index: "emails",
    });

    console.log("EMAIL INDEX VERIFIED");
    console.log("Index mappings:", JSON.stringify(result.emails.mappings, null, 2));
  } catch (error) {
    console.error("INDEX CREATION FAILED:", error);
    process.exitCode = 1;
  } finally {
    await elasticsearchClient.close();
  }
}

main();