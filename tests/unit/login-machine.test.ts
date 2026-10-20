import { expect, test } from "bun:test";
import { Effect, Fiber } from "effect";
import { createEffectActor, waitFor } from "@xstate/effect";
import { LoginAuth, LoginFailure, loginMachine } from "../../src/auth/login-machine";

const emailCommand = {
  kind: "email" as const,
  mode: "sign-in" as const,
  email: "member@example.test",
  password: "never-persist-this-password",
};

test("login succeeds without retaining password in the persisted actor snapshot", async () => {
  let calls = 0;
  const actorResult = await Effect.runPromise(
    Effect.scoped(Effect.gen(function*() {
      const actor = yield* createEffectActor(loginMachine);
      actor.send({ type: "SUBMIT", command: emailCommand });
      yield* waitFor(actor, (snapshot) => snapshot.matches("authenticated"), {
        timeout: "2 seconds",
      });
      return JSON.stringify(actor.getPersistedSnapshot());
    })).pipe(Effect.provideService(LoginAuth, {
      authenticate: () => Effect.sync(() => {
        calls += 1;
      }),
      signOut: () => Effect.void,
    })),
  );

  expect(calls).toBe(1);
  expect(actorResult).not.toContain(emailCommand.password);
});

test("login failures expose a generic state rather than the service error", async () => {
  const snapshot = await Effect.runPromise(
    Effect.scoped(Effect.gen(function*() {
      const actor = yield* createEffectActor(loginMachine);
      actor.send({ type: "SUBMIT", command: emailCommand });
      return yield* waitFor(actor, (value) => value.matches("failed"), {
        timeout: "2 seconds",
      });
    })).pipe(Effect.provideService(LoginAuth, {
      authenticate: () => Effect.fail(new LoginFailure()),
      signOut: () => Effect.void,
    })),
  );

  expect(snapshot.context.error).toBe("LOGIN_FAILED");
  expect(JSON.stringify(snapshot)).not.toContain("service stack");
});

test("disposing the login actor interrupts an in-flight authentication effect", async () => {
  let signalStarted: () => void = () => {};
  let interrupted = false;
  const started = new Promise<void>((resolve) => {
    signalStarted = resolve;
  });
  const program = Effect.scoped(Effect.gen(function*() {
    const actor = yield* createEffectActor(loginMachine);
    actor.send({ type: "SUBMIT", command: emailCommand });
    yield* Effect.never;
  })).pipe(Effect.provideService(LoginAuth, {
    authenticate: () =>
      Effect.sync(signalStarted).pipe(
        Effect.andThen(Effect.never),
        Effect.onInterrupt(() => Effect.sync(() => {
          interrupted = true;
        })),
      ),
    signOut: () => Effect.void,
  }));
  const fiber = Effect.runFork(program);

  await started;
  await Effect.runPromise(Fiber.interrupt(fiber));

  expect(interrupted).toBe(true);
});
