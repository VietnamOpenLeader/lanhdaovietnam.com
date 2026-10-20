import { Effect } from "effect";
import type { ContentInput, ContentKind, Locale } from "./contracts";
import type { AdminCursor, Cursor } from "./pagination";
import { ContentRepository } from "./repository.server";

export const listContent = (filters: {
  readonly locale: Locale;
  readonly kind?: ContentKind;
  readonly includeDrafts: boolean;
  readonly limit: number;
  readonly cursor?: Cursor;
}) =>
  Effect.gen(function* () {
    const repository = yield* ContentRepository;
    return yield* repository.list(filters);
  });

export const listAdminContent = (filters: {
  readonly locale: Locale;
  readonly kind?: ContentKind;
  readonly limit: number;
  readonly cursor?: AdminCursor;
}) =>
  Effect.gen(function* () {
    const repository = yield* ContentRepository;
    return yield* repository.listAdmin(filters);
  });

export const countPublishedByLocale = (locale: Locale) =>
  Effect.gen(function* () {
    const repository = yield* ContentRepository;
    return yield* repository.countPublishedByLocale(locale);
  });

export const listPublishedSlugs = (locale: Locale, limit: number, offset: number) =>
  Effect.gen(function* () {
    const repository = yield* ContentRepository;
    return yield* repository.listPublishedSlugs(locale, limit, offset);
  });

export const createContent = (input: ContentInput) =>
  Effect.gen(function* () {
    const repository = yield* ContentRepository;
    return yield* repository.create(input);
  });

export const getPublished = (locale: Locale, slug: string) =>
  Effect.gen(function* () {
    const repository = yield* ContentRepository;
    return yield* repository.getPublished(locale, slug);
  });

export const listPublishedTranslations = (translationKey: string) =>
  Effect.gen(function* () {
    const repository = yield* ContentRepository;
    return yield* repository.listPublishedTranslations(translationKey);
  });

export const findForTranslationKeys = (keys: ReadonlyArray<string>) =>
  Effect.gen(function* () {
    const repository = yield* ContentRepository;
    return yield* repository.findForTranslationKeys(keys);
  });

export const getContent = (id: string) =>
  Effect.gen(function* () {
    const repository = yield* ContentRepository;
    return yield* repository.getById(id);
  });

export const replaceContent = (id: string, input: ContentInput, version: number) =>
  Effect.gen(function* () {
    const repository = yield* ContentRepository;
    return yield* repository.replace(id, input, version);
  });

export const removeContent = (id: string, version: number) =>
  Effect.gen(function* () {
    const repository = yield* ContentRepository;
    return yield* repository.remove(id, version);
  });
