import { OAuth2Client } from "google-auth-library";
import { env } from "../config/env";

const googleClient = new OAuth2Client(
  env.GOOGLE_CLIENT_ID,
  env.GOOGLE_CLIENT_SECRET,
  env.GOOGLE_REDIRECT_URI
);

export interface GoogleUserProfile {
  googleId: string;
  email: string;
  name: string;
  avatar: string | null;
}

export function getGoogleAuthorizationUrl(state: string): string {
  return googleClient.generateAuthUrl({
    access_type: "online",
    scope: ["openid", "email", "profile"],
    state,
    prompt: "select_account",
  });
}

export async function verifyGoogleAuthorizationCode(
  code: string
): Promise<GoogleUserProfile> {
  const { tokens } = await googleClient.getToken(code);

  if (!tokens.id_token) {
    throw new Error("Google did not return an ID token");
  }

  const ticket = await googleClient.verifyIdToken({
    idToken: tokens.id_token,
    audience: env.GOOGLE_CLIENT_ID,
  });

  const payload = ticket.getPayload();

  if (
    !payload ||
    !payload.sub ||
    !payload.email ||
    !payload.email_verified
  ) {
    throw new Error("Google account identity could not be verified");
  }

  return {
    googleId: payload.sub,
    email: payload.email,
    name: payload.name || payload.email,
    avatar: payload.picture || null,
  };
}
