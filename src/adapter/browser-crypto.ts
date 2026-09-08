// PR Lens's render entry point imports its Node hashing helper even for SVG-only
// rendering. This narrow browser shim preserves that helper's SHA-256 behavior.
import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex } from "@noble/hashes/utils";
export function createHash(algorithm: string) {
  if (algorithm !== "sha256") throw new Error("Unsupported hashing algorithm");
  const hash = sha256.create();
  return {
    update(value: string) {
      hash.update(new TextEncoder().encode(value));
      return this;
    },
    digest(format: string) {
      if (format !== "hex") throw new Error("Unsupported hash format");
      return bytesToHex(hash.digest());
    },
  };
}
