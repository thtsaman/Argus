import { createHash } from "crypto";

/**
 * Computes canonical lowercase 64-character SHA-256 hex string from Buffer.
 */
export function computeSha256(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex").toLowerCase();
}

/**
 * Simple Mulberry32 deterministic pseudo-random number generator.
 */
export function createDeterministicPrng(seedString: string) {
  // Convert string to 32-bit integer seed
  let hash = 0;
  for (let i = 0; i < seedString.length; i++) {
    hash = (Math.imul(31, hash) + seedString.charCodeAt(i)) | 0;
  }

  let state = hash >>> 0;

  return function nextRandom(): number {
    state = (state + 0x6d2b79f5) | 0;
    let z = Math.imul(state ^ (state >>> 15), state | 1);
    z = z ^ (z + Math.imul(z ^ (z >>> 7), z | 61));
    return ((z ^ (z >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Format raw lowercase 64-char SHA-256 hash into 4-char grouped uppercase string for display.
 * Example: "8f2c9e7d..." -> "8F2C 9E7D A41C 92B8 ..."
 */
export function formatDisplayHash(hash: string): string {
  if (!hash) return "";
  const upper = hash.toUpperCase();
  const chunks: string[] = [];
  for (let i = 0; i < upper.length; i += 4) {
    chunks.push(upper.slice(i, i + 4));
  }
  return chunks.join(" ");
}

/**
 * Generate human-readable unique Integrity ID based on investigation case number and version.
 * Example: ARG-QM-0042-V01-7F3A
 */
export function generateIntegrityId(caseNumber: string, version: number): string {
  const sanitizedCase = caseNumber.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  const vStr = `V${String(version).padStart(2, "0")}`;
  const randomSuffix = createHash("sha256")
    ? createHash("sha256").update(`${caseNumber}-${version}-${Date.now()}`).digest("hex").slice(0, 4).toUpperCase()
    : "7F3A";
  return `ARG-${sanitizedCase}-${vStr}-${randomSuffix}`;
}
