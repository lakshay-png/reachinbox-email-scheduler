import { env } from "../config/env";

const SESSION_COOKIE_NAME = "reachinbox_session";
const SESSION_DURATION_SECONDS = 7 * 24 * 60 * 60;

const sessionSecret = new TextEncoder().encode(env.SESSION_SECRET);

export async function createSessionToken(userId: string): Promise<string> {
  const { SignJWT } = await import("jose");

  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .sign(sessionSecret);
}

export async function verifySessionToken(
  token: string
): Promise<string | null> {
  try {
    const { jwtVerify } = await import("jose");

    const { payload } = await jwtVerify(token, sessionSecret, {
      algorithms: ["HS256"],
    });

    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

export const sessionCookie = {
  name: SESSION_COOKIE_NAME,
  maxAge: SESSION_DURATION_SECONDS * 1000,
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};
