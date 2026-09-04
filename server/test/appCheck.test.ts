/**
 * LOCAL - App Check middleware tests. Token verification itself belongs to
 * Firebase Admin and is covered by the production smoke checklist.
 */
import { expect } from "chai";
import { Request, Response } from "express";
import { requireAppCheck } from "../src/middleware/appCheck";

function runAppCheck(token?: string) {
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

  return requireAppCheck(req, res, () => {
    calledNext = true;
  }).then(() => ({ statusCode, body, calledNext }));
}

describe("App Check middleware", () => {
  const previous = process.env.ENFORCE_APP_CHECK;

  afterEach(() => {
    if (previous === undefined) delete process.env.ENFORCE_APP_CHECK;
    else process.env.ENFORCE_APP_CHECK = previous;
  });

  it("preserves local and emulator flows when enforcement is disabled", async () => {
    process.env.ENFORCE_APP_CHECK = "false";
    expect(await runAppCheck()).to.deep.include({ statusCode: 200, calledNext: true });
  });

  it("rejects a production request that has no App Check token", async () => {
    process.env.ENFORCE_APP_CHECK = "true";
    expect(await runAppCheck()).to.deep.include({
      statusCode: 401,
      body: { error: "App verification is required" },
      calledNext: false,
    });
  });
});
