/**
 * LOCAL - pure authentication tests for the private redaction worker.
 */
import { expect } from "chai";
import { Request, Response } from "express";
import { requireRetentionWorker } from "../src/middleware/retentionWorker";

function runWorker(token: string | undefined) {
  let statusCode = 200;
  let body: Record<string, string> | undefined;
  let calledNext = false;
  const req = {
    header: () => token,
  } as unknown as Request;
  const res = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(value: Record<string, string>) {
      body = value;
      return this;
    },
  } as unknown as Response;

  requireRetentionWorker(req, res, () => {
    calledNext = true;
  });
  return { statusCode, body, calledNext };
}

describe("Retention worker authentication", () => {
  const previous = process.env.RETENTION_WORKER_TOKEN;

  afterEach(() => {
    if (previous === undefined) delete process.env.RETENTION_WORKER_TOKEN;
    else process.env.RETENTION_WORKER_TOKEN = previous;
  });

  it("fails closed when the worker is not configured", () => {
    delete process.env.RETENTION_WORKER_TOKEN;
    expect(runWorker("anything")).to.deep.include({ statusCode: 503, calledNext: false });
  });

  it("rejects a missing or incorrect token", () => {
    process.env.RETENTION_WORKER_TOKEN = "expected-token";
    expect(runWorker(undefined)).to.deep.include({ statusCode: 401, calledNext: false });
    expect(runWorker("wrong-token")).to.deep.include({ statusCode: 401, calledNext: false });
  });

  it("accepts only the configured token", () => {
    process.env.RETENTION_WORKER_TOKEN = "expected-token";
    expect(runWorker("expected-token")).to.deep.include({ statusCode: 200, calledNext: true });
  });
});
