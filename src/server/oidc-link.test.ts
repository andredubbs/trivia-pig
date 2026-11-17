import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  discovery: vi.fn(), authorizationCodeGrant: vi.fn(), createUser: vi.fn(),
  user: { findUnique: vi.fn(), update: vi.fn(), count: vi.fn() },
  session: { deleteMany: vi.fn() }, apiToken: { deleteMany: vi.fn() },
  oAuthGrant: { deleteMany: vi.fn() }, oAuthCode: { deleteMany: vi.fn() },
  transaction: vi.fn(),
}));
vi.mock("openid-client", () => ({
  discovery: mocks.discovery, authorizationCodeGrant: mocks.authorizationCodeGrant,
  None: () => "dummy-none",
}));
vi.mock("./db", () => ({ prisma: {
  user: mocks.user, session: mocks.session, apiToken: mocks.apiToken,
  oAuthGrant: mocks.oAuthGrant, oAuthCode: mocks.oAuthCode,
  $transaction: mocks.transaction,
} }));
vi.mock("./env", () => ({ env: {
  oidcIssuer: "https://issuer.example.test", oidcClientId: "dummy-client",
  oidcClientSecret: "", oidcRequiredRole: "", oidcAdminRole: "",
  oidcAdminRoleSet: false, appUrl: "https://trivia.example.test",
} }));
vi.mock("./auth", () => ({
  createUser: mocks.createUser, listedAdmin: () => false,
  normaliseEmail: (value: string) => value.trim().toLowerCase(),
}));
import { finishLogin } from "./oidc";

const owner = { id: "linked-owner", email: "owner@example.test", name: "Owner", isAdmin: false, oidcSub: null, passwordHash: "prior-password" };
const pending = { state: "dummy-state", nonce: "dummy-nonce", verifier: "dummy-verifier", next: "/dashboard", exp: Date.now() + 60_000 };
const kinds = ["session", "apiToken", "oAuthGrant", "oAuthCode"] as const;
let credentials: Record<typeof kinds[number], { userId: string }[]>;

beforeEach(() => {
  vi.resetAllMocks();
  mocks.discovery.mockResolvedValue({});
  mocks.authorizationCodeGrant.mockResolvedValue({ claims: () => ({ sub: "verified-sub", email: owner.email, email_verified: true }), access_token: undefined });
  mocks.user.findUnique.mockImplementation(async ({ where }) => where.oidcSub ? null : { ...owner });
  mocks.user.update.mockImplementation(async ({ data }) => ({ ...owner, ...data }));
  mocks.transaction.mockImplementation(async (operations) => Promise.all(operations));
  credentials = Object.fromEntries(kinds.map((kind) => [kind, [{ userId: owner.id }, { userId: "unrelated-owner" }]])) as typeof credentials;
  for (const kind of kinds) {
    mocks[kind].deleteMany.mockImplementation(async ({ where }) => {
      const before = credentials[kind].length;
      credentials[kind] = credentials[kind].filter((row) => row.userId !== where.userId);
      return { count: before - credentials[kind].length };
    });
  }
});

describe("verified OIDC linking revokes preexisting account credentials", () => {
  it("revokes all prior browser/API/OAuth credentials for the linked owner only", async () => {
    const result = await finishLogin(new URL("https://trivia.example.test/api/auth/oidc/callback?code=dummy&state=dummy-state"), pending);
    expect(result.user.id).toBe(owner.id);
    expect(result.user.oidcSub).toBe("verified-sub");
    expect(result.user.passwordHash).toBeNull();
    expect(result.next).toBe("/dashboard");
    expect(mocks.createUser).not.toHaveBeenCalled();
    expect(mocks.transaction).toHaveBeenCalledTimes(1);
    for (const kind of kinds) {
      expect(credentials[kind]).toEqual([{ userId: "unrelated-owner" }]);
      expect(mocks[kind].deleteMany).toHaveBeenCalledExactlyOnceWith({ where: { userId: owner.id } });
    }
    expect(mocks.transaction.mock.calls[0][0]).toHaveLength(5);
  });

  it("does not revoke credentials on ordinary login to an already-linked account", async () => {
    mocks.user.findUnique.mockResolvedValue({ ...owner, oidcSub: "verified-sub", passwordHash: null });
    const result = await finishLogin(new URL("https://trivia.example.test/api/auth/oidc/callback?code=dummy&state=dummy-state"), pending);
    expect(result.user.id).toBe(owner.id);
    expect(mocks.transaction).not.toHaveBeenCalled();
    for (const kind of kinds) expect(mocks[kind].deleteMany).not.toHaveBeenCalled();
  });
});
