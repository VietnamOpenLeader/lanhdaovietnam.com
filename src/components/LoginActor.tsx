import { useEffect, useState } from "react";
import { useSelector } from "@xstate/react";
import { createEffectActor } from "@xstate/effect";
import type { EffectActor } from "@xstate/effect";
import { Effect, Fiber } from "effect";
import type { Locale } from "../i18n/locales";
import { createLoginAuth } from "../auth/login-client";
import { LoginAuth, loginMachine } from "../auth/login-machine";

export function useLoginActor(locale: Locale) {
  const [actorState, setActorState] = useState<{
    readonly locale: Locale;
    readonly actor: EffectActor<typeof loginMachine>;
  }>();
  const actor = actorState?.locale === locale ? actorState.actor : undefined;
  const snapshot = useSelector(actor, (value) => value);

  useEffect(() => {
    const fiber = Effect.runFork(
      Effect.scoped(
        Effect.gen(function* () {
          const loginActor = yield* createEffectActor(loginMachine);
          yield* Effect.sync(() => setActorState({ locale, actor: loginActor }));
          yield* Effect.never;
        }),
      ).pipe(Effect.provideService(LoginAuth, createLoginAuth(locale))),
    );

    return () => {
      Effect.runFork(Fiber.interrupt(fiber));
    };
  }, [locale]);

  return { actor, snapshot };
}
