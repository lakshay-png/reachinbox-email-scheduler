
import {
  createSlackOAuthState,
  consumeSlackOAuthState,
} from "./slack-oauth-state.service";

async function runTest() {
  const testUserId = "slack-oauth-test-user";

  try {
    const state = await createSlackOAuthState(testUserId);

    if (!/^[0-9a-f]{64}$/.test(state)) {
      throw new Error("Generated state has an invalid format.");
    }

    console.log("OAuth state generated successfully.");

    const firstResult = await consumeSlackOAuthState(state);

    if (firstResult !== testUserId) {
      throw new Error("State validation failed.");
    }

    console.log("OAuth state validated successfully.");

    const secondResult = await consumeSlackOAuthState(state);

    if (secondResult !== null) {
      throw new Error("State was reused, but should be one-time only.");
    }

    console.log("OAuth state cannot be reused.");

    const invalidResult = await consumeSlackOAuthState("invalid-state");

    if (invalidResult !== null) {
      throw new Error("Invalid state should be rejected.");
    }

    console.log("Invalid OAuth state rejected.");
    console.log("ALL SLACK OAUTH STATE TESTS PASSED");
  } finally {
    await import("../config/redis.js").then(({ redisConnection }) =>
      redisConnection.quit()
    );
  }
}

runTest().catch((error) => {
  console.error("SLACK OAUTH STATE TEST FAILED:", error);
  process.exitCode = 1;
});
