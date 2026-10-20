import { expect, test } from "bun:test";
import { Effect } from "effect";
import {
  authorizeContentAdmin,
  authorizeContentChecker,
} from "../../src/auth/policy";
import { ContentError } from "../../src/core/errors";

const noAdmins = { adminUserIds: [], tokenSha256: undefined };

test("denies signed-in non-admins and missing bearer credentials", async () => {
  const member = authorizeContentAdmin(
    { userId: "member", method: "GET" },
    noAdmins,
  );
  const missingToken = authorizeContentAdmin(
    { method: "POST", authorization: undefined, expectedOrigin: "https://site.test" },
    noAdmins,
  );

  await expect(Effect.runPromise(member)).rejects.toBeInstanceOf(ContentError);
  await expect(Effect.runPromise(member))
    .rejects.toMatchObject({ _tag: "ContentError", status: 403 });
  await expect(Effect.runPromise(missingToken))
    .rejects.toMatchObject({ _tag: "ContentError", status: 401 });
});

test("restricts session mutations to same-origin admins", async () => {
  const policy = { adminUserIds: ["admin-1"], tokenSha256: undefined };
  const allowed = authorizeContentAdmin(
    {
      userId: "admin-1",
      method: "POST",
      origin: "https://site.test",
      expectedOrigin: "https://site.test",
    },
    policy,
  );
  const crossOrigin = authorizeContentAdmin(
    {
      userId: "admin-1",
      method: "DELETE",
      origin: "https://attacker.test",
      expectedOrigin: "https://site.test",
    },
    policy,
  );

  expect(await Effect.runPromise(allowed)).toEqual({ kind: "session", userId: "admin-1" });
  await expect(Effect.runPromise(crossOrigin))
    .rejects.toMatchObject({ _tag: "ContentError", status: 403 });
});

test("accepts only the configured fixed-length token digest", async () => {
  const token = "A".repeat(43);
  const digestBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  const tokenSha256 = [...new Uint8Array(digestBuffer)]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
  const request = (authorization: string) =>
    authorizeContentAdmin({ method: "POST", authorization }, {
      adminUserIds: [],
      tokenSha256,
    });

  expect(await Effect.runPromise(request(`Bearer ${token}`))).toEqual({ kind: "token" });
  await expect(Effect.runPromise(request("Bearer incorrect")))
    .rejects.toMatchObject({ _tag: "ContentError", status: 401 });
  await expect(Effect.runPromise(request(`Bearer ${token}`.repeat(3))))
    .rejects.toMatchObject({ _tag: "ContentError", status: 401 });
});

test("read-only content check tokens cannot authorize content mutations", async () => {
  const token = "R".repeat(43);
  const digestBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  const tokenSha256 = [...new Uint8Array(digestBuffer)]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
  const request = { method: "POST", authorization: `Bearer ${token}` };

  expect(await Effect.runPromise(authorizeContentChecker(request, {
    adminUserIds: [],
    readOnlyTokenSha256: tokenSha256,
  }))).toEqual({ kind: "token" });
  await expect(Effect.runPromise(authorizeContentAdmin(request, noAdmins)))
    .rejects.toMatchObject({ _tag: "ContentError", status: 401 });
});
