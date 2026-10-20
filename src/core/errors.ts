import { Data } from "effect";

export type ContentErrorCode =
  | "VALIDATION"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "TOO_LARGE"
  | "UPSTREAM"
  | "INTERNAL";

export type ContentField =
  | "translationKey"
  | "locale"
  | "slug"
  | "kind"
  | "title"
  | "description"
  | "body"
  | "status"
  | "publishedAt"
  | "startsAt"
  | "endsAt"
  | "location"
  | "version";

export class ContentError extends Data.TaggedError("ContentError")<{
  readonly status: 400 | 401 | 403 | 404 | 409 | 413 | 422 | 500;
  readonly code: ContentErrorCode;
  readonly fields?: Partial<Record<ContentField, string>>;
}> {}
