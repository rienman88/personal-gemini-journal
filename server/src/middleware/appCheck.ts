/**
 * CLOUD - optional second authorization signal for the public API.
 * Firebase Auth identifies the user; App Check verifies that the request came
 * from an attested instance of this application.
 */
import { getAppCheck } from "firebase-admin/app-check";
import { Request, Response, NextFunction } from "express";

export async function requireAppCheck(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (process.env.ENFORCE_APP_CHECK !== "true") {
    next();
    return;
  }

  const token = req.header("X-Firebase-AppCheck");
  if (!token) {
    res.status(401).json({ error: "App verification is required" });
    return;
  }

  try {
    await getAppCheck().verifyToken(token);
    next();
  } catch {
    // Do not log or return the App Check token. It is a bearer credential.
    res.status(401).json({ error: "App verification failed" });
  }
}
