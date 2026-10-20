import { Schema } from "effect";
import { locales } from "../i18n/locales";

export { locales } from "../i18n/locales";
export type { Locale } from "../i18n/locales";

export const contentKinds = ["article", "news", "event"] as const;
export const contentStatuses = ["draft", "published"] as const;
export const maxBodyBytes = 200 * 1024;

export type ContentKind = (typeof contentKinds)[number];
export type ContentStatus = (typeof contentStatuses)[number];
export type ContentSource = "markdown" | "d1";

const nonEmptyString = (maxLength: number) =>
  Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(maxLength));

const slugSchema = Schema.String.check(
  Schema.isMinLength(1),
  Schema.isMaxLength(160),
  Schema.isPattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u),
);

const timestampPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
const timestampSchema = Schema.String.check(
  Schema.isPattern(timestampPattern),
  Schema.makeFilter((value) => {
    const date = new Date(value);
    return Number.isFinite(date.valueOf()) && date.toISOString() === value
      ? undefined
      : "Expected a valid UTC timestamp";
  }),
);
const optionalTimestampSchema = Schema.NullOr(timestampSchema);

const metadataFields = {
  translationKey: Schema.String.check(
    Schema.isMinLength(1),
    Schema.isMaxLength(160),
    Schema.isPattern(/^[A-Za-z0-9_.-]+$/u),
  ),
  locale: Schema.Literals(locales),
  slug: slugSchema,
  kind: Schema.Literals(contentKinds),
  title: nonEmptyString(200),
  description: nonEmptyString(500),
  status: Schema.Literals(contentStatuses),
  publishedAt: optionalTimestampSchema,
  startsAt: optionalTimestampSchema,
  endsAt: optionalTimestampSchema,
  location: Schema.NullOr(nonEmptyString(200)),
};

type Metadata = Schema.Schema.Type<Schema.Struct<typeof metadataFields>>;

function validateMetadata(value: Metadata): string | undefined {
  if (value.status === "published" && value.publishedAt === null) {
    return "Published content requires publishedAt";
  }
  if (value.kind !== "event") {
    return value.startsAt === null && value.endsAt === null && value.location === null
      ? undefined
      : "Only events may include event details";
  }
  if (value.startsAt === null || value.location === null) {
    return "Events require a start time and location";
  }
  if (value.endsAt !== null && value.endsAt < value.startsAt) {
    return "Event endsAt must not precede startsAt";
  }
  return undefined;
}

const metadataShape = Schema.Struct(metadataFields);
const strictParseOptions = { onExcessProperty: "error" } as const;

export const contentMetadataSchema = metadataShape.check(Schema.makeFilter(validateMetadata));
export const contentInputSchema = Schema.Struct({
  ...metadataFields,
  body: Schema.String.check(
    Schema.makeFilter((body) =>
      new TextEncoder().encode(body).byteLength <= maxBodyBytes
        ? undefined
        : `Body exceeds ${maxBodyBytes} bytes`,
    ),
  ),
}).check(Schema.makeFilter(validateMetadata));

export type ContentInput = Schema.Schema.Type<typeof contentInputSchema>;
export type ContentMetadata = Schema.Schema.Type<typeof contentMetadataSchema>;

export const updateContentSchema = Schema.Struct({
  ...metadataFields,
  body: Schema.String.check(
    Schema.makeFilter((body) =>
      new TextEncoder().encode(body).byteLength <= maxBodyBytes
        ? undefined
        : `Body exceeds ${maxBodyBytes} bytes`,
    ),
  ),
  version: Schema.Number.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(1)),
}).check(Schema.makeFilter((value) => validateMetadata(value)));

export const contentQuerySchema = Schema.Struct({
  locale: Schema.Literals(locales),
  kind: Schema.optional(Schema.Literals(contentKinds)),
  limit: Schema.Number.check(
    Schema.isInt(),
    Schema.isGreaterThanOrEqualTo(1),
    Schema.isLessThanOrEqualTo(100),
  ),
  cursor: Schema.NullOr(Schema.String),
});

export const contentInputStandardSchema = Schema.toStandardSchemaV1(contentInputSchema, {
  parseOptions: strictParseOptions,
});

export const contentCheckCandidateSchema = Schema.Struct({
  entries: Schema.Array(contentMetadataSchema).check(Schema.isMaxLength(500)),
});

export const contentCheckResultSchema = Schema.Struct({
  checkedCount: Schema.Number.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(0)),
  conflictKeys: Schema.Array(Schema.String),
});

export type ContentCheckCandidate = Schema.Schema.Type<typeof contentCheckCandidateSchema>;
export type ContentCheckResult = Schema.Schema.Type<typeof contentCheckResultSchema>;
