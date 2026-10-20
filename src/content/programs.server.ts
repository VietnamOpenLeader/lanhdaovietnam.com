import { Effect } from "effect";
import type { ContentInput, ContentKind, Locale } from "./contracts";
import type { Cursor } from "./pagination";
import { ContentRepository } from "./repository.server";

export const listContent = (filters: {
  readonly locale: Locale;
  readonly kind?: ContentKind;
  readonly includeDrafts: boolean;
  readonly limit: number;
  readonly cursor?: Cursor;
}) =>
  Effect.gen(function*() {
    const repository = yield* ContentRepository;
    return yield* repository.list(filters);
  });

export const createContent = (input: ContentInput) =>
  Effect.gen(function*() {
    const repository = yield* ContentRepository;
    return yield* repository.create(input);
  });

export const getPublished = (locale: Locale, slug: string) =>
  Effect.gen(function*() {
    const repository = yield* ContentRepository;
    return yield* repository.getPublished(locale, slug);
  });

export const listPublishedTranslations = (translationKey: string) =>
  Effect.gen(function*() {
    const repository = yield* ContentRepository;
    return yield* repository.listPublishedTranslations(translationKey);
  });

export const getContent = (id: string) =>
  Effect.gen(function*() {
    const repository = yield* ContentRepository;
    return yield* repository.getById(id);
  });

export const replaceContent = (id: string, input: ContentInput, version: number) =>
  Effect.gen(function*() {
    const repository = yield* ContentRepository;
    return yield* repository.replace(id, input, version);
  });

export const removeContent = (id: string, version: number) =>
  Effect.gen(function*() {
    const repository = yield* ContentRepository;
    return yield* repository.remove(id, version);
  });
