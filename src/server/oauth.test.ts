import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const db = vi.hoisted(() => ({
  oAuthCode: { findUnique: vi.fn(), deleteMany: vi.fn() },
  oAuthGrant: { deleteMany: vi.fn(), count: vi.fn(), create: vi.fn() },
}));
vi.mock("./db", () => ({ prisma: db }));
vi.mock("./env", () => ({ env: { appUrl: "https://trivia.example.test" } }));
import { exchange } from "./oauth";

const verifier = "v".repeat(43);
const form = {
  grant_type: "authorization_code", code: "dummy-code", client_id: "dummy-client",
  redirect_uri: "https://client.example.test/callback", code_verifier: verifier,
};
const code = () => ({
  id: "dummy-code-id", userId: "dummy-owner", clientId: form.client_id,
  redirectUri: form.redirect_uri,
  codeChallenge: createHash("sha256").update(verifier).digest("base64url"),
  expiresAt: new Date(Date.now() + 60_000),
});

beforeEach(() => {
  vi.resetAllMocks();
  db.oAuthGrant.deleteMany.mockResolvedValue({ count: 0 });
  db.oAuthGrant.count.mockResolvedValue(0);
  db.oAuthGrant.create.mockResolvedValue({ id: "new-grant" });
});

describe("authorization code consumption", () => {
  it("allows only the atomic-delete winner when two requests read the same code", async () => {
    const row = code();
    let readers = 0;
    let release!: () => void;
    const bothRead = new Promise<void>((resolve) => { release = resolve; });
    db.oAuthCode.findUnique.mockImplementation(async () => {
      readers += 1;
      if (readers === 2) release();
      await bothRead;
      return row;
    });
    let present = true;
    db.oAuthCode.deleteMany.mockImplementation(async () => {
      const count = present ? 1 : 0;
      present = false;
      return { count };
    });
    const responses = await Promise.all([exchange(form), exchange(form)]);
    expect(responses.map((r) => r.status).sort()).toEqual([200, 400]);
    expect(await responses.find((r) => r.status === 400)!.json()).toMatchObject({ error: "invalid_grant" });
    expect(db.oAuthGrant.create).toHaveBeenCalledTimes(1);
    expect(db.oAuthGrant.deleteMany).toHaveBeenCalledTimes(1);
  });

  it("rejects sequential reuse and preserves burning a code on a wrong verifier", async () => {
    db.oAuthCode.findUnique.mockResolvedValueOnce(code()).mockResolvedValueOnce(null);
    db.oAuthCode.deleteMany.mockResolvedValue({ count: 1 });
    expect((await exchange({ ...form, code_verifier: "x".repeat(43) })).status).toBe(400);
    expect((await exchange(form)).status).toBe(400);
    expect(db.oAuthCode.deleteMany).toHaveBeenCalledTimes(1);
    expect(db.oAuthGrant.create).not.toHaveBeenCalled();
  });

  it("rejects expired codes without issuing a grant", async () => {
    db.oAuthCode.findUnique.mockResolvedValue({ ...code(), expiresAt: new Date(0) });
    db.oAuthCode.deleteMany.mockResolvedValue({ count: 1 });
    expect((await exchange(form)).status).toBe(400);
    expect(db.oAuthGrant.create).not.toHaveBeenCalled();
  });
});
