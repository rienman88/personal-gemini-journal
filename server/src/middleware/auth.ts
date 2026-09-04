/**
 * CLOUD — deploys inside the Cloud Run container.
 *
 * Callable Functions verified the caller's Firebase ID token automatically.
 * Cloud Run doesn't — this middleware is that missing piece, applied to
 * every protected route. If this middleware is ever accidentally left off
 * a route, that route is wide open — it is intentionally the very first
 * thing every route handler goes through.
 */

import { Request, Response, NextFunction } from "express";
import { getAuth } from "firebase-admin/auth";

export interface AuthedRequest extends Request {
  uid?: string;
}

export async function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    res.status(401).json({ error: "unauthenticated" });
    return;
  }
  const idToken = header.slice("Bearer ".length);
  try {
    const decoded = await getAuth().verifyIdToken(idToken);
    req.uid = decoded.uid;
    next();
  } catch (err) {
    console.error("Token verification failed:", err);
    res.status(401).json({ error: "unauthenticated" });
  }
}