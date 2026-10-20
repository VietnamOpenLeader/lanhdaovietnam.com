import { Effect } from "effect";
import { auth } from "void/client";
import type { Locale } from "../i18n/locales";
import { LoginFailure, type LoginAuthShape, type LoginCommand } from "./login-machine";

function responseHasError(response: unknown): boolean {
  return (
    typeof response === "object" &&
    response !== null &&
    "error" in response &&
    response.error !== null &&
    response.error !== undefined
  );
}

function authEffect(operation: () => Promise<unknown>): Effect.Effect<void, LoginFailure> {
  return Effect.tryPromise({
    try: async () => {
      const response = await operation();
      if (responseHasError(response)) throw new LoginFailure();
    },
    catch: () => new LoginFailure(),
  }).pipe(Effect.asVoid);
}

function authenticate(
  command: LoginCommand,
  callbackURL: string,
): Effect.Effect<void, LoginFailure> {
  if (command.kind === "social") {
    return authEffect(() =>
      auth.signIn.social({
        provider: command.provider,
        callbackURL,
      }),
    );
  }
  if (command.mode === "sign-up") {
    const name = command.name;
    if (!name) return Effect.fail(new LoginFailure());
    return authEffect(() =>
      auth.signUp.email({
        email: command.email,
        password: command.password,
        name,
      }),
    );
  }
  return authEffect(() =>
    auth.signIn.email({
      email: command.email,
      password: command.password,
    }),
  );
}

export function createLoginAuth(locale: Locale): LoginAuthShape {
  const callbackURL = new URL(`/${locale}/`, window.location.origin).toString();
  return {
    authenticate: (command) => authenticate(command, callbackURL),
    signOut: () => authEffect(() => auth.signOut()),
  };
}
