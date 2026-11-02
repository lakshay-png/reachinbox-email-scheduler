
import { randomBytes, timingSafeEqual } from "node:crypto";
import { redisConnection } from "../config/redis";

const STATE_PREFIX = "slack:oauth:state:";
const STATE_TTL_SECONDS = 600;

export async function createSlackOAuthState(
  userId: string
): Promise<string> {
  const state = randomBytes(32).toString("hex");

  await redisConnection.set(
    `${STATE_PREFIX}${state}`,
    userId,
    "EX",
    STATE_TTL_SECONDS,
    "NX"
  );

  return state;
}

export async function consumeSlackOAuthState(
  state: string
): Promise<string | null> {
  if (!/^[0-9a-f]{64}$/.test(state)) {
    return null;
  }

  const key = `${STATE_PREFIX}${state}`;

  // GET and DELETE atomically so a state cannot be reused.
  const script = `
    local value = redis.call("GET", KEYS[1])
    if value then
      redis.call("DEL", KEYS[1])
    end
    return value
  `;

  const userId = await redisConnection.eval(
    script,
    1,
    key
  ) as string | null;

  return userId;
}
