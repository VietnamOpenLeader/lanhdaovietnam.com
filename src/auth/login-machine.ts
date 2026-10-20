import { Context, Data, Effect, Schema } from "effect";
import { setupEffect } from "@xstate/effect";
import { socialProviderNames, type SocialProvider } from "./social-providers";

const emailCommandSchema = Schema.Struct({
  kind: Schema.Literal("email"),
  mode: Schema.Literals(["sign-in", "sign-up"]),
  email: Schema.String,
  password: Schema.String,
  name: Schema.optional(Schema.String),
});
const socialCommandSchema = Schema.Struct({
  kind: Schema.Literal("social"),
  provider: Schema.Literals(socialProviderNames),
});

export const loginCommandSchema = Schema.Union([emailCommandSchema, socialCommandSchema]);

export type LoginCommand = Schema.Schema.Type<typeof loginCommandSchema>;

export class LoginFailure extends Data.TaggedError("LoginFailure")<Record<never, never>> {}

export interface LoginAuthShape {
  readonly authenticate: (command: LoginCommand) => Effect.Effect<void, LoginFailure>;
  readonly signOut: () => Effect.Effect<void, LoginFailure>;
}

export class LoginAuth extends Context.Service<LoginAuth, LoginAuthShape>()(
  "lanhdaovietnam/auth/LoginAuth",
) {}

function authenticationEffect(
  command: LoginCommand,
  self: { send: (event: { readonly type: "AUTHENTICATED" | "FAILED" }) => void },
): Effect.Effect<void, never, LoginAuth> {
  return LoginAuth.use((auth) =>
    Effect.match(auth.authenticate(command), {
      onSuccess: () => self.send({ type: "AUTHENTICATED" }),
      onFailure: () => self.send({ type: "FAILED" }),
    }),
  );
}

function signOutEffect(self: {
  send: (event: { readonly type: "SIGNED_OUT" | "FAILED" }) => void;
}): Effect.Effect<void, never, LoginAuth> {
  return LoginAuth.use((auth) =>
    Effect.match(auth.signOut(), {
      onSuccess: () => self.send({ type: "SIGNED_OUT" }),
      onFailure: () => self.send({ type: "FAILED" }),
    }),
  );
}

export const loginMachine = setupEffect({
  schemas: {
    context: Schema.Struct({ error: Schema.NullOr(Schema.String) }),
    events: {
      SUBMIT: Schema.Struct({ command: loginCommandSchema }),
      AUTHENTICATED: Schema.Struct({}),
      FAILED: Schema.Struct({}),
      SIGN_OUT: Schema.Struct({}),
      SIGNED_OUT: Schema.Struct({}),
    },
  },
  actions: {
    authenticate: ({ event, self }) => {
      if (event.type !== "SUBMIT") return Effect.void;
      return authenticationEffect(event.command, self);
    },
    signOut: ({ self }) => signOutEffect(self),
  },
}).createMachine({
  id: "login",
  initial: "idle",
  context: { error: null },
  states: {
    idle: {
      on: {
        SUBMIT: (args, enqueue) => {
          enqueue(args.actions.authenticate, args);
          return { target: "submitting", context: { error: null } };
        },
        SIGN_OUT: (args, enqueue) => {
          enqueue(args.actions.signOut, args);
          return { target: "signingOut" };
        },
      },
    },
    submitting: {
      on: {
        AUTHENTICATED: () => ({ target: "authenticated" }),
        FAILED: () => ({
          target: "failed",
          context: { error: "LOGIN_FAILED" },
        }),
      },
    },
    failed: {
      on: {
        SUBMIT: (args, enqueue) => {
          enqueue(args.actions.authenticate, args);
          return { target: "submitting", context: { error: null } };
        },
      },
    },
    authenticated: {
      on: {
        SIGN_OUT: (args, enqueue) => {
          enqueue(args.actions.signOut, args);
          return { target: "signingOut" };
        },
      },
    },
    signingOut: {
      on: {
        SIGNED_OUT: () => ({ target: "signedOut" }),
        FAILED: () => ({
          target: "failed",
          context: { error: "LOGIN_FAILED" },
        }),
      },
    },
    signedOut: {
      on: {
        SUBMIT: (args, enqueue) => {
          enqueue(args.actions.authenticate, args);
          return { target: "submitting", context: { error: null } };
        },
      },
    },
  },
});

export type LoginState =
  | "idle"
  | "submitting"
  | "authenticated"
  | "failed"
  | "signingOut"
  | "signedOut";

export type { SocialProvider };
