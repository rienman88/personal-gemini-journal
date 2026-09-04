/**
 * CLOUD - private retention worker routes.
 *
 * This route is intended for a daily Cloud Scheduler request. It is not
 * mounted under Firebase user auth because it processes due records across
 * users using the Admin SDK.
 */
import { Router, Request, Response } from "express";
import { redactExpiredRetention } from "../lib/retention";

export const retentionRouter = Router();

retentionRouter.post("/redact", async (req: Request, res: Response) => {
  const requestedLimit = Number(req.body?.limit ?? 50);
  const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(Math.floor(requestedLimit), 1), 200) : 50;

  try {
    const result = await redactExpiredRetention(limit);
    res.json(result);
  } catch (err) {
    console.error("POST /internal/retention/redact error:", err);
    res.status(500).json({ error: "retention redaction failed" });
  }
});
