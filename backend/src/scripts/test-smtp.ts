
import { verifyMailConnection } from "../config/mail";

async function main() {
  try {
    console.log("Testing Ethereal SMTP connection...");

    await verifyMailConnection();

    console.log("SMTP TEST PASSED");
  } catch (error) {
    console.error("SMTP TEST FAILED:", error);
    process.exitCode = 1;
  }
}

main();

