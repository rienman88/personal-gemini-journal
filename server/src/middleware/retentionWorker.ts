/**
 * CLOUD - authenticates the private retention worker endpoint.
 *
 * The scheduler does not have a Firebase user token. It sends a dedicated
 * secret instead, and the endpoint performs no user-controlled reads.
 */
import { timingSafeEqual } from "crypto";
import { Request, Response, NextFunction } from "express";

export function requireRetentionWorker(req: Request, res: Response, next: NextFunction): void {
  const configuredToken = process.env.RETENTION_WORKER_TOKEN;
  const suppliedToken = req.header("X-Retention-Worker-Token");

  if (!configuredToken) {
    res.status(503).json({ error: "retention worker is not configured" });
    return;
  }

  if (!suppliedToken) {
    res.status(401).json({ error: "unauthenticated" });
    return;
  }

  const configured = Buffer.from(configuredToken, "utf8");
  const supplied = Buffer.from(suppliedToken, "utf8");
  const valid = configured.length === supplied.length && timingSafeEqual(configured, supplied);

  if (!valid) {
    res.status(401).json({ error: "unauthenticated" });
    return;
  }

  next();
}
