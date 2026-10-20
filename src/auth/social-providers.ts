export const socialProviderNames = ["github", "google", "twitter"] as const;
export type SocialProvider = (typeof socialProviderNames)[number];

export const socialProviderEnvNames = {
  github: {
    clientId: "AUTH_GITHUB_CLIENT_ID",
    clientSecret: "AUTH_GITHUB_CLIENT_SECRET",
  },
  google: {
    clientId: "AUTH_GOOGLE_CLIENT_ID",
    clientSecret: "AUTH_GOOGLE_CLIENT_SECRET",
  },
  twitter: {
    clientId: "AUTH_TWITTER_CLIENT_ID",
    clientSecret: "AUTH_TWITTER_CLIENT_SECRET",
  },
} as const satisfies Record<
  SocialProvider,
  { readonly clientId: string; readonly clientSecret: string }
>;

export interface SocialCredentials {
  readonly clientId: string;
  readonly clientSecret: string;
}

export type SocialCredentialSet = Partial<Record<SocialProvider, SocialCredentials>>;

export function socialCredentials(
  clientId: string | undefined,
  clientSecret: string | undefined,
): SocialCredentials | undefined {
  return clientId && clientSecret ? { clientId, clientSecret } : undefined;
}

export function configuredSocialProviderNames(
  credentials: SocialCredentialSet,
): ReadonlyArray<SocialProvider> {
  return socialProviderNames.filter((provider) => credentials[provider] !== undefined);
}

export function socialProviderConfiguration(
  credentials: SocialCredentialSet,
): Partial<Record<SocialProvider, SocialCredentials>> {
  const names = configuredSocialProviderNames(credentials);
  return {
    ...(names.includes("github") && credentials.github ? { github: credentials.github } : {}),
    ...(names.includes("google") && credentials.google ? { google: credentials.google } : {}),
    ...(names.includes("twitter") && credentials.twitter ? { twitter: credentials.twitter } : {}),
  };
}
