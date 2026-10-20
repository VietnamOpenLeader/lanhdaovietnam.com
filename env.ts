import { defineEnv, json, string, url } from "void/env";

export default defineEnv({
  ADMIN_USER_IDS: json<string[]>().default([]),
  CONTENT_API_TOKEN_SHA256: string().optional(),
  SITE_URL: url().default("https://lanhdaovietnam.com"),
  AUTH_GITHUB_CLIENT_ID: string().optional(),
  AUTH_GITHUB_CLIENT_SECRET: string().optional(),
  AUTH_GOOGLE_CLIENT_ID: string().optional(),
  AUTH_GOOGLE_CLIENT_SECRET: string().optional(),
  AUTH_TWITTER_CLIENT_ID: string().optional(),
  AUTH_TWITTER_CLIENT_SECRET: string().optional(),
});
