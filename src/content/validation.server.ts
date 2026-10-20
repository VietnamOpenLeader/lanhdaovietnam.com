import { Schema } from "effect";
import { ContentError } from "../core/errors";
import {
  contentInputSchema,
  contentQuerySchema,
  locales,
  updateContentSchema,
  type ContentInput,
  type ContentKind,
  type Locale,
} from "./contracts";

export interface ContentListQuery {
  readonly locale: Locale;
  readonly kind?: ContentKind;
  readonly limit: number;
}

export interface VersionedContentInput {
  readonly input: ContentInput;
  readonly version: number;
}

function invalidRequest(): ContentError {
  return new ContentError({ status: 422, code: "VALIDATION" });
}

export function parseContentInput(value: unknown): ContentInput {
  try {
    return Schema.decodeUnknownSync(contentInputSchema, { onExcessProperty: "error" })(value);
  } catch {
    throw invalidRequest();
  }
}

export function parseVersionedContentInput(value: unknown): VersionedContentInput {
  try {
    const parsed = Schema.decodeUnknownSync(updateContentSchema, {
      onExcessProperty: "error",
    })(value);
    const { version, ...input } = parsed;
    return { input, version };
  } catch {
    throw invalidRequest();
  }
}

export function parseContentVersion(value: unknown): number {
  try {
    return Schema.decodeUnknownSync(Schema.Struct({
      version: Schema.Number.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(1)),
    }), { onExcessProperty: "error" })(value).version;
  } catch {
    throw invalidRequest();
  }
}

export function parseContentListQuery(query: URLSearchParams): ContentListQuery {
  const localeValue = query.get("locale");
  const locale = locales.find((candidate) => candidate === localeValue);
  const rawKind = query.get("kind");
  const limitValue = query.get("limit");

  try {
    const parsed = Schema.decodeUnknownSync(contentQuerySchema)({
      locale,
      ...(rawKind === null ? {} : { kind: rawKind }),
      limit: limitValue === null ? 20 : Number(limitValue),
      cursor: query.get("cursor"),
    });
    return parsed.kind === undefined
      ? { locale: parsed.locale, limit: parsed.limit }
      : { locale: parsed.locale, kind: parsed.kind, limit: parsed.limit };
  } catch {
    throw new ContentError({ status: 400, code: "VALIDATION" });
  }
}
