import { expect, test } from "bun:test";
import { Schema } from "effect";
import { baseURL } from "../local-context";

const signUpResponseSchema = Schema.Struct({
  user: Schema.Struct({
    id: Schema.String,
    name: Schema.String,
  }),
});

const profileSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  isAdmin: Schema.Boolean,
});

test("supports email signup and keeps authenticated members non-admin", async () => {
  const anonymousProfile = await fetch(`${baseURL}/api/profile`);
  expect(anonymousProfile.status).toBe(401);

  const signup = await fetch(`${baseURL}/api/auth/sign-up/email`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: baseURL,
    },
    body: JSON.stringify({
      name: "Test member",
      email: `member-${crypto.randomUUID()}@example.test`,
      password: "test-password-123",
    }),
  });
  expect(signup.status).toBe(200);
  const created = Schema.decodeUnknownSync(signUpResponseSchema)(await signup.json());
  const setCookie = signup.headers.get("set-cookie");
  expect(setCookie).not.toBeNull();

  const profile = await fetch(`${baseURL}/api/profile`, {
    headers: { Cookie: setCookie?.split(";", 1)[0] ?? "" },
  });
  expect(profile.status).toBe(200);
  expect(Schema.decodeUnknownSync(profileSchema)(await profile.json()))
    .toEqual({ ...created.user, isAdmin: false });
});
