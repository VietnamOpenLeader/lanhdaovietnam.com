import type { Messages } from "@lingui/core";
import { Button } from "@cloudflare/kumo/components/button";
import { Input } from "@cloudflare/kumo/components/input";
import { useLingui } from "@lingui/react";
import { useEffect, useState, type FormEvent } from "react";
import {
  authError,
  displayName,
  email,
  loginModeSwitch,
  loginTitle,
  password,
  signIn,
  signOut,
  signOutPending,
  signUp,
  signedInMessage,
  signupModeSwitch,
  signupTitle,
  socialProviderUnavailable,
  socialSignInHeading,
} from "../i18n/messages";
import type { Locale } from "../i18n/locales";
import { LocaleProvider } from "../i18n/runtime";
import type { SocialProvider } from "../auth/social-providers";
import { useLoginActor } from "./LoginActor";

interface LoginIslandProps {
  readonly locale: Locale;
  readonly messages: Messages;
  readonly availableProviders: ReadonlyArray<SocialProvider>;
  readonly userName: string | null;
}

const socialProviders: ReadonlyArray<{ readonly id: SocialProvider; readonly label: string }> = [
  { id: "github", label: "GitHub" },
  { id: "google", label: "Google" },
  { id: "twitter", label: "X" },
];

function readFormField(data: FormData, key: string): string {
  const value = data.get(key);
  return typeof value === "string" ? value : "";
}

export default function LoginIsland({
  locale,
  messages,
  availableProviders,
  userName,
}: LoginIslandProps) {
  return (
    <LocaleProvider locale={locale} messages={messages}>
      <LoginForm
        availableProviders={availableProviders}
        locale={locale}
        userName={userName}
      />
    </LocaleProvider>
  );
}

interface LoginFormProps extends Omit<LoginIslandProps, "messages"> {}

function LoginForm({ locale, availableProviders, userName }: LoginFormProps) {
  const { _ } = useLingui();
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const { actor, snapshot } = useLoginActor(locale);
  const state = snapshot?.value ?? "idle";
  const pending = state === "submitting" || state === "signingOut";
  const signedIn = state === "authenticated"
    || (userName !== null && state !== "signedOut");

  useEffect(() => {
    if (state === "authenticated") window.location.assign(`/${locale}/`);
  }, [locale, state]);

  function submitEmail(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (!actor) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const name = readFormField(data, "name");
    actor.send({
      type: "SUBMIT",
      command: {
        kind: "email",
        mode,
        email: readFormField(data, "email"),
        password: readFormField(data, "password"),
        ...(mode === "sign-up" ? { name } : {}),
      },
    });
    form.reset();
  }

  function submitSocial(provider: SocialProvider): void {
    actor?.send({ type: "SUBMIT", command: { kind: "social", provider } });
  }

  return (
    <main className="mx-auto max-w-md px-6 py-10">
      <section className="ring ring-kumo-line rounded-xl p-6">
        {signedIn ? (
          <div className="space-y-4">
            <h1 className="text-xl font-semibold">{_(signedInMessage)}</h1>
            {userName ? <p className="text-sm">{userName}</p> : null}
            {snapshot?.context.error ? (
              <p aria-live="polite" className="text-sm text-kumo-danger" role="alert">
                {_(authError)}
              </p>
            ) : null}
            <Button
              disabled={!actor || pending}
              loading={state === "signingOut"}
              onClick={() => actor?.send({ type: "SIGN_OUT" })}
              size="base"
              variant="secondary"
              className="text-sm"
            >
              {state === "signingOut" ? _(signOutPending) : _(signOut)}
            </Button>
          </div>
        ) : (
          <>
            <h1 className="text-xl font-semibold">
              {mode === "sign-in" ? _(loginTitle) : _(signupTitle)}
            </h1>
            <form className="mt-5 grid gap-4" onSubmit={submitEmail}>
              {mode === "sign-up" ? (
                <div className="grid gap-2">
                  <label
                    className="text-sm font-medium"
                    htmlFor="login-name"
                    id="login-name-label"
                  >
                    {_(displayName)}
                  </label>
                  <Input
                    aria-labelledby="login-name-label"
                    autoComplete="name"
                    className="text-sm"
                    disabled={pending}
                    id="login-name"
                    name="name"
                    required
                  />
                </div>
              ) : null}
              <div className="grid gap-2">
                <label
                  className="text-sm font-medium"
                  htmlFor="login-email"
                  id="login-email-label"
                >
                  {_(email)}
                </label>
                <Input
                  aria-labelledby="login-email-label"
                  autoComplete="email"
                  className="text-sm"
                  disabled={pending}
                  id="login-email"
                  name="email"
                  required
                  type="email"
                />
              </div>
              <div className="grid gap-2">
                <label
                  className="text-sm font-medium"
                  htmlFor="login-password"
                  id="login-password-label"
                >
                  {_(password)}
                </label>
                <Input
                  aria-labelledby="login-password-label"
                  autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
                  className="text-sm"
                  disabled={pending}
                  id="login-password"
                  minLength={8}
                  name="password"
                  required
                  type="password"
                />
              </div>
              {snapshot?.context.error ? (
                <p aria-live="polite" className="text-sm text-kumo-danger" role="alert">
                  {_(authError)}
                </p>
              ) : null}
              <Button
                disabled={!actor || pending}
                loading={pending}
                size="base"
                type="submit"
                variant="primary"
                className="text-sm"
              >
                {mode === "sign-in" ? _(signIn) : _(signUp)}
              </Button>
            </form>
            <button
              className="mt-4 text-sm underline-offset-4 hover:underline"
              disabled={pending}
              onClick={() => setMode(mode === "sign-in" ? "sign-up" : "sign-in")}
              type="button"
            >
              {mode === "sign-in" ? _(loginModeSwitch) : _(signupModeSwitch)}
            </button>
            <div className="mt-6 border-t border-kumo-line pt-4">
              <h2 className="mb-3 text-sm font-medium">{_(socialSignInHeading)}</h2>
              <div className="grid gap-2">
                {socialProviders.map(({ id, label }) => {
                  const available = availableProviders.includes(id);
                  return (
                    <div key={id}>
                      <Button
                        className="w-full text-sm"
                        disabled={!available || !actor || pending}
                        onClick={() => submitSocial(id)}
                        size="base"
                        variant="secondary"
                      >
                        {label}
                      </Button>
                      {!available ? (
                        <p className="mt-1 text-sm text-kumo-subtle">
                          {_(socialProviderUnavailable.id, { provider: label })}
                        </p>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
