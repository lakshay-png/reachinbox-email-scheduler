import { randomBytes } from "node:crypto";
import { redisConnection } from "../config/redis";

const STATE_PREFIX = "google:oauth:state:";
const STATE_TTL_SECONDS = 600;

export async function createGoogleOAuthState(): Promise<string> {
  const state = randomBytes(32).toString("hex");

  const result = await redisConnection.set(
    `${STATE_PREFIX}${state}`,
    "pending",
    "EX",
    STATE_TTL_SECONDS,
    "NX"
  );

  if (result !== "OK") {
    throw new Error("Failed to create Google OAuth state");
  }

  return state;
}

export async function consumeGoogleOAuthState(
  state: string
): Promise<boolean> {
  if (!/^[0-9a-f]{64}$/.test(state)) {
    return false;
  }

  const script = `
    local value = redis.call("GET", KEYS[1])
    if value then
      redis.call("DEL", KEYS[1])
    end
    return value
  `;

  const result = await redisConnection.eval(
    script,
    1,
    `${STATE_PREFIX}${state}`
  );

  return result === "pending";
}
