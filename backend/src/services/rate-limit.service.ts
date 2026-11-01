import { redisConnection } from "../config/redis";

const ONE_HOUR_MS = 60 * 60 * 1000;
const COUNTER_TTL_SECONDS = 2 * 60 * 60;

/**
 * Atomically checks and reserves a sending slot.
 *
 * KEYS[1] = hourly counter key
 * KEYS[2] = minimum delay key
 *
 * ARGV[1] = current timestamp in milliseconds
 * ARGV[2] = hourly limit
 * ARGV[3] = minimum delay in milliseconds
 * ARGV[4] = counter TTL in seconds
 */
const RATE_LIMIT_LUA = `
local now = tonumber(ARGV[1])
local hourlyLimit = tonumber(ARGV[2])
local minDelay = tonumber(ARGV[3])
local counterTTL = tonumber(ARGV[4])

local currentCount = tonumber(redis.call("GET", KEYS[1]) or "0")

-- Check hourly sending limit
if currentCount >= hourlyLimit then
    local remaining = 3600000 - (now % 3600000)

    return {0, "HOURLY_LIMIT", remaining, currentCount}
end

-- Check minimum delay between sending reservations
local nextAllowedAt = tonumber(redis.call("GET", KEYS[2]) or "0")

if now < nextAllowedAt then
    return {0, "MIN_DELAY", nextAllowedAt - now, currentCount}
end

-- Reserve one hourly sending slot
local newCount = redis.call("INCR", KEYS[1])

if newCount == 1 then
    redis.call("EXPIRE", KEYS[1], counterTTL)
end

-- Reserve the minimum-delay window
if minDelay > 0 then
    redis.call(
        "SET",
        KEYS[2],
        tostring(now + minDelay),
        "PX",
        minDelay
    )
end

return {1, "ALLOWED", 0, newCount}
`;

export interface RateLimitResult {
  allowed: boolean;
  reason: "ALLOWED" | "HOURLY_LIMIT" | "MIN_DELAY";
  retryAfterMs: number;
  currentCount: number;
}

export async function checkAndReserveSendingSlot(
  senderId: string,
  hourlyLimit: number,
  minDelayMs: number
): Promise<RateLimitResult> {
  if (!senderId) {
    throw new Error("Sender ID is required");
  }

  if (!Number.isInteger(hourlyLimit) || hourlyLimit < 1) {
    throw new Error("Hourly limit must be a positive integer");
  }

  if (!Number.isFinite(minDelayMs) || minDelayMs < 0) {
    throw new Error("Minimum delay must be a non-negative number");
  }

  const now = Date.now();

  // Use UTC hour buckets for predictable hourly limits.
  const hourBucket = Math.floor(now / ONE_HOUR_MS);

  const hourlyKey = `email:rate:hourly:${senderId}:${hourBucket}`;
  const delayKey = `email:rate:delay:${senderId}`;

  const result = (await redisConnection.eval(
    RATE_LIMIT_LUA,
    2,
    hourlyKey,
    delayKey,
    now,
    hourlyLimit,
    minDelayMs,
    COUNTER_TTL_SECONDS
  )) as [number, string, number, number];

  return {
    allowed: result[0] === 1,
    reason: result[1] as RateLimitResult["reason"],
    retryAfterMs: Number(result[2]),
    currentCount: Number(result[3]),
  };
}
