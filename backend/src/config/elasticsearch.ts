import { Client } from "@elastic/elasticsearch";
import { env } from "./env";

export const elasticsearchClient = new Client({
  node: env.ELASTICSEARCH_NODE,
  requestTimeout: 10000,
  maxRetries: 3,
});

export async function verifyElasticsearchConnection(): Promise<void> {
  const health = await elasticsearchClient.cluster.health();

  console.log("Elasticsearch connection verified successfully.");
  console.log("Cluster status:", health.status);
}