import { Context, Effect } from "effect";
import { and, desc, eq, sql } from "void/db";
import { contentPosts } from "@schema";
import { ContentError } from "../core/errors";
import type { ContentInput, ContentKind, Locale } from "./contracts";

export type ContentRecord = typeof contentPosts.$inferSelect;
export type ContentMetadataRecord = Pick<
  ContentRecord,
  | "id"
  | "translationKey"
  | "locale"
  | "slug"
  | "kind"
  | "title"
  | "description"
  | "status"
  | "publishedAt"
  | "startsAt"
  | "endsAt"
  | "location"
  | "createdAt"
  | "updatedAt"
  | "version"
>;

export interface ContentRepositoryShape {
  readonly list: (filters: {
    readonly locale: Locale;
    readonly kind?: ContentKind;
    readonly includeDrafts: boolean;
    readonly limit: number;
  }) => Effect.Effect<ReadonlyArray<ContentMetadataRecord>, ContentError>;
  readonly getById: (id: string) => Effect.Effect<ContentRecord, ContentError>;
  readonly getPublished: (
    locale: Locale,
    slug: string,
  ) => Effect.Effect<ContentRecord, ContentError>;
  readonly create: (input: ContentInput) => Effect.Effect<ContentRecord, ContentError>;
  readonly replace: (
    id: string,
    input: ContentInput,
    version: number,
  ) => Effect.Effect<ContentRecord, ContentError>;
  readonly remove: (id: string, version: number) => Effect.Effect<void, ContentError>;
}

export const ContentRepository = Context.Service<ContentRepositoryShape>(
  "lanhdaovietnam/content/ContentRepository",
);

function readErrorMessage(error: unknown, depth = 0): string {
  if (depth > 4 || typeof error !== "object" || error === null) return "";
  const message = "message" in error && typeof error.message === "string"
    ? error.message
    : "";
  const cause = "cause" in error ? readErrorMessage(error.cause, depth + 1) : "";
  return `${message} ${cause}`;
}

function databaseError(error: unknown): ContentError {
  if (error instanceof ContentError) return error;
  return /unique constraint|constraint failed/iu.test(readErrorMessage(error))
    ? new ContentError({ status: 409, code: "CONFLICT" })
    : new ContentError({ status: 500, code: "INTERNAL" });
}

function databaseEffect<A>(operation: () => Promise<A>): Effect.Effect<A, ContentError> {
  return Effect.tryPromise({ try: operation, catch: databaseError });
}

function makeRepository(database: typeof import("void/db").db): ContentRepositoryShape {
  return {
    list: ({ locale, kind, includeDrafts, limit }) =>
      databaseEffect(async () => {
        const conditions = [
          eq(contentPosts.locale, locale),
          ...(includeDrafts ? [] : [eq(contentPosts.status, "published")]),
          ...(kind ? [eq(contentPosts.kind, kind)] : []),
        ];
        return database.select({
          id: contentPosts.id,
          translationKey: contentPosts.translationKey,
          locale: contentPosts.locale,
          slug: contentPosts.slug,
          kind: contentPosts.kind,
          title: contentPosts.title,
          description: contentPosts.description,
          status: contentPosts.status,
          publishedAt: contentPosts.publishedAt,
          startsAt: contentPosts.startsAt,
          endsAt: contentPosts.endsAt,
          location: contentPosts.location,
          createdAt: contentPosts.createdAt,
          updatedAt: contentPosts.updatedAt,
          version: contentPosts.version,
        })
          .from(contentPosts)
          .where(and(...conditions))
          .orderBy(desc(contentPosts.publishedAt), desc(contentPosts.id))
          .limit(limit);
      }),
    getById: (id) =>
      databaseEffect(async () => {
        const [record] = await database.select().from(contentPosts)
          .where(eq(contentPosts.id, id)).limit(1);
        if (!record) throw new ContentError({ status: 404, code: "NOT_FOUND" });
        return record;
      }),
    getPublished: (locale, slug) =>
      databaseEffect(async () => {
        const [record] = await database.select().from(contentPosts)
          .where(and(
            eq(contentPosts.locale, locale),
            eq(contentPosts.slug, slug),
            eq(contentPosts.status, "published"),
          ))
          .limit(1);
        if (!record) throw new ContentError({ status: 404, code: "NOT_FOUND" });
        return record;
      }),
    create: (input) =>
      databaseEffect(async () => {
        const now = new Date().toISOString();
        const [record] = await database.insert(contentPosts).values({
          ...input,
          id: crypto.randomUUID(),
          createdAt: now,
          updatedAt: now,
          version: 1,
        }).returning();
        if (!record) throw new ContentError({ status: 500, code: "INTERNAL" });
        return record;
      }),
    replace: (id, input, version) =>
      databaseEffect(async () => {
        const [record] = await database.update(contentPosts).set({
          ...input,
          updatedAt: new Date().toISOString(),
          version: sql`${contentPosts.version} + 1`,
        }).where(and(
          eq(contentPosts.id, id),
          eq(contentPosts.version, version),
        )).returning();
        if (record) return record;

        const [existing] = await database.select({ id: contentPosts.id })
          .from(contentPosts).where(eq(contentPosts.id, id)).limit(1);
        throw existing
          ? new ContentError({ status: 409, code: "CONFLICT" })
          : new ContentError({ status: 404, code: "NOT_FOUND" });
      }),
    remove: (id, version) =>
      databaseEffect(async () => {
        const [deleted] = await database.delete(contentPosts).where(and(
          eq(contentPosts.id, id),
          eq(contentPosts.version, version),
        )).returning({ id: contentPosts.id });
        if (deleted) return;

        const [existing] = await database.select({ id: contentPosts.id })
          .from(contentPosts).where(eq(contentPosts.id, id)).limit(1);
        throw existing
          ? new ContentError({ status: 409, code: "CONFLICT" })
          : new ContentError({ status: 404, code: "NOT_FOUND" });
      }),
  };
}

export const makeContentRepository = makeRepository;
