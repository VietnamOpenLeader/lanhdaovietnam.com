import { defineAuth, type VoidAuthConfigContext } from "void/auth";
import {
  socialCredentials,
  socialProviderConfiguration,
  socialProviderEnvNames,
  type SocialCredentialSet,
  type SocialCredentials,
} from "./src/auth/social-providers.ts";

function readSocialCredentials(
  env: VoidAuthConfigContext["env"],
  clientIdName: string,
  clientSecretName: string,
): SocialCredentials | undefined {
  const clientId = env[clientIdName];
  const clientSecret = env[clientSecretName];
  if (
    typeof clientId !== "string" ||
    clientId.length === 0 ||
    typeof clientSecret !== "string" ||
    clientSecret.length === 0
  ) {
    return undefined;
  }
  return socialCredentials(clientId, clientSecret);
}

// Void loads app-specific auth configuration from the root auth.ts default export.
export default defineAuth(({ defaults, env }) => {
  const github = readSocialCredentials(
    env,
    socialProviderEnvNames.github.clientId,
    socialProviderEnvNames.github.clientSecret,
  );
  const google = readSocialCredentials(
    env,
    socialProviderEnvNames.google.clientId,
    socialProviderEnvNames.google.clientSecret,
  );
  const twitter = readSocialCredentials(
    env,
    socialProviderEnvNames.twitter.clientId,
    socialProviderEnvNames.twitter.clientSecret,
  );

  const credentials: SocialCredentialSet = {
    github,
    google,
    twitter,
  };
  return {
    ...defaults,
    socialProviders: {
      ...defaults.socialProviders,
      ...socialProviderConfiguration(credentials),
    },
  };
});
