/**
 * CLOUD — deploys inside the Cloud Run container. This one process does
 * both jobs: serves the built frontend AND the API, so the single Cloud
 * Run URL submitted is the actual usable app, not a bare API response.
 */

import "dotenv/config"; // Must be line 1
import express from "express";
import cors from "cors";
import path from "path";
import * as admin from "firebase-admin";
import { requireAuth } from "./middleware/auth";
import { requireAppCheck } from "./middleware/appCheck";
import { requireRetentionWorker } from "./middleware/retentionWorker";
import { journalRouter } from "./routes/journal";
import { retentionRouter } from "./routes/retention";

import fs from "fs";

// Explicitly bind to the deployed Firebase project; load the ignored local
// key.json only when running locally. The compiled server lives one directory
// deeper under lib/src, while source execution resolves from src.
const localKeyPaths = [path.join(__dirname, "../../key.json"), path.join(__dirname, "../key.json")];
const keyPath = localKeyPaths.find((candidate) => fs.existsSync(candidate));
const projectId =
  process.env.GCP_PROJECT ||
  process.env.GOOGLE_CLOUD_PROJECT ||
  process.env.GCLOUD_PROJECT ||
  "gen-lang-client-0752053463";

admin.initializeApp({
  projectId,
  ...(keyPath ? { credential: admin.credential.cert(require(keyPath)) } : {}),
});

const app = express();

// Explicit origin allowlist, never a wildcard — mostly moot in production
// since the frontend and API are served same-origin here, but the local
// dev frontend (Vite on its own port) still needs this.
// Allow process.env.ALLOWED_ORIGINS in production, with fallback to local Vite dev ports
const localOrigins = ["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:5174"];
const envOrigins = (process.env.ALLOWED_ORIGINS ?? "").split(",").map((o) => o.trim()).filter(Boolean);
const allowedOrigins = [...localOrigins, ...envOrigins];

function matchesRequestHost(origin: string, requestHost: string | undefined): boolean {
  if (!requestHost) return false;
  try {
    return new URL(origin).host === requestHost;
  } catch {
    return false;
  }
}

// The browser may reach Cloud Run through more than one valid service hostname.
// Allow same-origin traffic by comparing Origin to Host, while keeping explicit
// cross-origin access limited to local development and ALLOWED_ORIGINS.
app.use((req, res, next) => {
  const requestHost = req.get("host");
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin) || matchesRequestHost(origin, requestHost)) {
        return callback(null, true);
      }
      callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })(req, res, next);
});

app.use((_req, res, next) => {
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
  next();
});

app.use(express.json({ limit: "1mb" }));

app.use("/internal/retention", requireRetentionWorker, retentionRouter);
app.use("/api", requireAuth, requireAppCheck, journalRouter);

// Keep the local /healthz contract and use /health for Cloud Run probes.
app.get(["/healthz", "/health"], (_req, res) => res.status(200).send("ok"));

// Path is 3 levels up from the COMPILED location (lib/src/index.js), not
// the source location (src/index.ts) — tsc's rootDir "." preserves the
// src/ nesting under lib/, so __dirname at runtime is lib/src, not lib.
// Verified against the actual compiled output, not assumed.
const webDist = path.join(__dirname, "../../../web-dist");
app.use(express.static(webDist));
app.get("*", (_req, res) => {
  res.sendFile(path.join(webDist, "index.html"));
});

const port = Number(process.env.PORT) || 8081; // Cloud Run always injects its own PORT; 8081 is only the local-dev fallback, chosen to avoid colliding with the Firestore emulator's conventional 8080
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Listening on port ${port}`);
});

export { app };
