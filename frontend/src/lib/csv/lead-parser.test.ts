
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parseLeadCSV } from "./lead-parser";

async function runTest() {
  const csvPath = join(
    process.cwd(),
    "src/lib/csv/__tests__/sample-leads.csv"
  );

  const csvContent = await readFile(csvPath, "utf-8");

  const file = new File([csvContent], "sample-leads.csv", {
    type: "text/csv",
  });

  const result = await parseLeadCSV(file);

  console.log("Total rows:", result.totalRows);
  console.log("Valid leads:", result.validLeads.length);
  console.log("Invalid leads:", result.invalidLeads.length);

  console.log("\nValid leads:");
  console.log(result.validLeads);

  console.log("\nInvalid leads:");
  console.log(result.invalidLeads);

  if (
    result.totalRows !== 6 ||
    result.validLeads.length !== 3 ||
    result.invalidLeads.length !== 3
  ) {
    throw new Error("CSV parser test failed.");
  }

  console.log("\nALL CSV PARSER TESTS PASSED");
}

runTest().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
