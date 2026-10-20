import { expect, test } from "bun:test";
import {
  configuredSocialProviderNames,
  socialCredentials,
  socialProviderConfiguration,
} from "../../src/auth/social-providers";

const github = {
  clientId: "test-client-id",
  clientSecret: "test-client-secret",
};

test("enables only social providers with both OAuth credentials", () => {
  const credentials = {
    github,
    google: socialCredentials("google-client-id", undefined),
    twitter: socialCredentials(undefined, "twitter-client-secret"),
  };
  expect(configuredSocialProviderNames(credentials)).toEqual(["github"]);
  expect(socialProviderConfiguration(credentials)).toEqual({ github });
  expect(socialProviderConfiguration({})).toEqual({});
});
