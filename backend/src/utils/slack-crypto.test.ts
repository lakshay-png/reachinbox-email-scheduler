
import {
  encryptSlackToken,
  decryptSlackToken,
} from "./slack-crypto";

const originalToken = "xoxb-test-token-for-encryption";

const encryptedToken = encryptSlackToken(originalToken);
const decryptedToken = decryptSlackToken(encryptedToken);

if (encryptedToken === originalToken) {
  throw new Error("Encryption failed: token was not encrypted.");
}

if (decryptedToken !== originalToken) {
  throw new Error("Decryption failed: tokens do not match.");
}

console.log("Encrypted token differs from original token.");
console.log("Decryption successful.");
console.log("ALL SLACK CRYPTO TESTS PASSED");
