import {
  elasticsearchClient,
  verifyElasticsearchConnection,
} from "../config/elasticsearch";

async function main() {
  try {
    console.log("Testing Elasticsearch connection...");

    await verifyElasticsearchConnection();

    console.log("ELASTICSEARCH TEST PASSED");
  } catch (error) {
    console.error("ELASTICSEARCH TEST FAILED:", error);
    process.exitCode = 1;
  } finally {
    await elasticsearchClient.close();
  }
}

main();