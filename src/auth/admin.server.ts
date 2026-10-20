import type { Effect } from "effect";
import type { CloudContext } from "void";
import { getUser } from "void/auth";
import { env } from "void/env";
import type { ContentError } from "../core/errors";
import { authorizeContentAdmin, authorizeContentChecker, type AdminIdentity } from "./policy";
import {
  configuredSocialProviderNames,
  socialCredentials,
  socialProviderEnvNames,
  type SocialCredentialSet,
  type SocialProvider,
} from "./social-providers";

export function getConfiguredSocialProviders(): ReadonlyArray<SocialProvider> {
  const credentials: SocialCredentialSet = {
    github: socialCredentials(
      env[socialProviderEnvNames.github.clientId],
      env[socialProviderEnvNames.github.clientSecret],
    ),
    google: socialCredentials(
      env[socialProviderEnvNames.google.clientId],
      env[socialProviderEnvNames.google.clientSecret],
    ),
    twitter: socialCredentials(
      env[socialProviderEnvNames.twitter.clientId],
      env[socialProviderEnvNames.twitter.clientSecret],
    ),
  };
  return configuredSocialProviderNames(credentials);
}

export function requireContentAdmin(
  context: CloudContext,
): Effect.Effect<AdminIdentity, ContentError> {
  const authorization = context.req.header("Authorization");
  const userId = authorization === undefined ? (getUser()?.id ?? null) : null;
  return authorizeContentAdmin(
    {
      userId,
      authorization,
      method: context.req.method,
      origin: context.req.header("Origin"),
      expectedOrigin: new URL(context.req.url).origin,
    },
    {
      adminUserIds: env.ADMIN_USER_IDS,
      tokenSha256: env.CONTENT_API_TOKEN_SHA256,
    },
  );
}

export function requireContentChecker(
  context: CloudContext,
): Effect.Effect<AdminIdentity, ContentError> {
  const authorization = context.req.header("Authorization");
  const userId = authorization === undefined ? (getUser()?.id ?? null) : null;
  return authorizeContentChecker(
    {
      userId,
      authorization,
      method: context.req.method,
      origin: context.req.header("Origin"),
      expectedOrigin: new URL(context.req.url).origin,
    },
    {
      adminUserIds: env.ADMIN_USER_IDS,
      tokenSha256: env.CONTENT_API_TOKEN_SHA256,
      readOnlyTokenSha256: env.CONTENT_CHECK_TOKEN_SHA256,
    },
  );
}
