import { timingSafeEqual } from "node:crypto";
import { Effect } from "effect";
import { ContentError } from "../core/errors";

const mutatingMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const bearerTokenPattern = /^Bearer ([A-Za-z0-9_-]{43,128})$/u;
const sha256HexPattern = /^[0-9a-f]{64}$/u;

export type AdminIdentity =
  | { readonly kind: "session"; readonly userId: string }
  | { readonly kind: "token" };

export interface AdminPolicy {
  readonly adminUserIds: ReadonlyArray<string>;
  readonly tokenSha256?: string;
}

export interface ContentCheckPolicy extends AdminPolicy {
  readonly readOnlyTokenSha256?: string;
}

export interface AdminRequest {
  readonly userId?: string | null;
  readonly authorization?: string;
  readonly method: string;
  readonly origin?: string;
  readonly expectedOrigin?: string;
}

function fail(status: 401 | 403): Effect.Effect<never, ContentError> {
  return Effect.fail(
    new ContentError({
      status,
      code: status === 401 ? "UNAUTHENTICATED" : "FORBIDDEN",
    }),
  );
}

function decodeExpectedDigest(value?: string): Uint8Array | null {
  if (!value || !sha256HexPattern.test(value)) return null;
  return Uint8Array.from(value.match(/.{2}/gu) ?? [], (byte) => Number.parseInt(byte, 16));
}

function hashToken(token: string): Effect.Effect<Uint8Array, ContentError> {
  return Effect.tryPromise({
    try: () => crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)),
    catch: () => new ContentError({ status: 500, code: "INTERNAL" }),
  }).pipe(Effect.map((digest) => new Uint8Array(digest)));
}

function sameDigest(left: Uint8Array, right: Uint8Array): boolean {
  return left.length === right.length && timingSafeEqual(left, right);
}

function authorizeBearer(
  authorization: string,
  expectedDigests: ReadonlyArray<string | undefined>,
): Effect.Effect<AdminIdentity, ContentError> {
  const token = bearerTokenPattern.exec(authorization)?.[1];
  const expected = expectedDigests
    .map(decodeExpectedDigest)
    .filter((digest): digest is Uint8Array => digest !== null && digest.length === 32);
  if (!token || expected.length === 0) return fail(401);
  return hashToken(token).pipe(
    Effect.flatMap((candidate) =>
      expected.reduce((matched, digest) => sameDigest(candidate, digest) || matched, false)
        ? Effect.succeed({ kind: "token" } as const)
        : fail(401),
    ),
  );
}

function authorizeSession(
  request: AdminRequest,
  policy: AdminPolicy,
): Effect.Effect<AdminIdentity, ContentError> {
  if (!request.userId) return fail(401);
  if (!policy.adminUserIds.includes(request.userId)) return fail(403);
  if (
    mutatingMethods.has(request.method) &&
    (!request.origin || request.origin !== request.expectedOrigin)
  ) {
    return fail(403);
  }
  return Effect.succeed({ kind: "session", userId: request.userId });
}

export function authorizeContentAdmin(
  request: AdminRequest,
  policy: AdminPolicy,
): Effect.Effect<AdminIdentity, ContentError> {
  if (request.authorization !== undefined) {
    return authorizeBearer(request.authorization, [policy.tokenSha256]);
  }
  return authorizeSession(request, policy);
}

export function authorizeContentChecker(
  request: AdminRequest,
  policy: ContentCheckPolicy,
): Effect.Effect<AdminIdentity, ContentError> {
  if (request.authorization !== undefined) {
    return authorizeBearer(request.authorization, [policy.tokenSha256, policy.readOnlyTokenSha256]);
  }
  return authorizeSession(request, policy);
}
