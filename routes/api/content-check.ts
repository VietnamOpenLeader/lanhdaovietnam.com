import { Effect, Schema } from "effect";
import { defineHandler } from "void";
import { requireContentChecker } from "../../src/auth/admin.server";
import { ContentError } from "../../src/core/errors";
import {
  contentCheckCandidateSchema,
  type ContentCheckCandidate,
} from "../../src/content/contracts";
import { markdownIndex } from "../../src/content/manifest.server";
import { checkContentConflicts } from "../../src/content/preflight.server";
import { contentErrorResponse } from "../../src/http/content-errors.server";
import { readJsonBody } from "../../src/http/json-body.server";

const maxCheckRequestBytes = 1_048_576;
const strictParseOptions = { onExcessProperty: "error" } as const;

function parseCandidate(value: unknown): ContentCheckCandidate {
  try {
    return Schema.decodeUnknownSync(contentCheckCandidateSchema, strictParseOptions)(value);
  } catch {
    throw new ContentError({ status: 422, code: "VALIDATION" });
  }
}

export const GET = defineHandler(async (context) => {
  try {
    await Effect.runPromise(requireContentChecker(context));
    return context.json(await checkContentConflicts(markdownIndex));
  } catch (error) {
    return contentErrorResponse(error);
  }
});

export const POST = defineHandler(async (context) => {
  try {
    await Effect.runPromise(requireContentChecker(context));
    const candidate = parseCandidate(await readJsonBody(context.req.raw, maxCheckRequestBytes));
    return context.json(await checkContentConflicts(candidate.entries));
  } catch (error) {
    return contentErrorResponse(error);
  }
});
