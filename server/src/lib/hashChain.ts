/**
 * CLOUD — deploys inside the Cloud Run container.
 *
 * One hash-chain primitive, reused everywhere something needs to be
 * tamper-evident: the main entry chain, and each entry's conversation
 * thread. A chain is just: hash(prevHash | uid | text | createdAt),
 * threaded so altering anything after the fact breaks every hash after it.
 */

import * as crypto from "crypto";

export const GENESIS = "GENESIS";

export function computeHash(prevHash: string, uid: string, text: string, createdAt: string): string {
  return crypto.createHash("sha256").update(`${prevHash}|${uid}|${text}|${createdAt}`).digest("hex");
}
