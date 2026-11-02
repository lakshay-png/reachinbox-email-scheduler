
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";
import { env } from "../config/env";

const ALGORITHM = "aes-256-gcm";

function getEncryptionKey(): Buffer {
  const key = env.SLACK_TOKEN_ENCRYPTION_KEY;

  if (!/^[0-9a-fA-F]{64}$/.test(key)) {
    throw new Error(
      "SLACK_TOKEN_ENCRYPTION_KEY must be exactly 64 hexadecimal characters."
    );
  }

  return Buffer.from(key, "hex");
}

export function encryptSlackToken(token: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, getEncryptionKey(), iv);

  const encrypted = Buffer.concat([
    cipher.update(token, "utf8"),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  return [
    iv.toString("hex"),
    authTag.toString("hex"),
    encrypted.toString("hex"),
  ].join(":");
}

export function decryptSlackToken(encryptedToken: string): string {
  const [ivHex, authTagHex, encryptedHex] = encryptedToken.split(":");

  if (!ivHex || !authTagHex || !encryptedHex) {
    throw new Error("Invalid encrypted Slack token format.");
  }

  const decipher = createDecipheriv(
    ALGORITHM,
    getEncryptionKey(),
    Buffer.from(ivHex, "hex")
  );

  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedHex, "hex")),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}
