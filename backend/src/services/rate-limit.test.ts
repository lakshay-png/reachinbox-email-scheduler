import {
  checkAndReserveSendingSlot,
} from "./rate-limit.service";

async function main() {
  const senderId = "stage4-test-sender-" + Date.now();

  console.log("\nTesting Redis rate limiter...\n");

  // First reservation should succeed
  const first = await checkAndReserveSendingSlot(
    senderId,
    2,
    2000
  );

  console.log("Test 1 - First reservation:", first);

  // Immediate second reservation should be blocked
  const second = await checkAndReserveSendingSlot(
    senderId,
    2,
    2000
  );

  console.log("Test 2 - Immediate reservation:", second);

  // Wait for minimum delay
  await new Promise((resolve) => setTimeout(resolve, 2100));

  // Second reservation should now succeed
  const third = await checkAndReserveSendingSlot(
    senderId,
    2,
    2000
  );

  console.log("Test 3 - Reservation after delay:", third);

  // Wait for minimum delay again
  await new Promise((resolve) => setTimeout(resolve, 2100));

  // Hourly limit should now block the third reservation
  const fourth = await checkAndReserveSendingSlot(
    senderId,
    2,
    2000
  );

  console.log("Test 4 - Hourly limit:", fourth);

  if (
    first.allowed &&
    !second.allowed &&
    third.allowed &&
    !fourth.allowed &&
    fourth.reason === "HOURLY_LIMIT"
  ) {
    console.log("\nALL RATE LIMIT TESTS PASSED");
  } else {
    throw new Error("One or more rate limiter tests failed");
  }
}

main()
  .catch((error) => {
    console.error("Rate limiter test failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    // Redis connection is shared by the application.
    // Close it after this standalone test.
    const { redisConnection } = await import("../config/redis.js");
    await redisConnection.quit();
  });
