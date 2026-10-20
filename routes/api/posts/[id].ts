import { Effect } from "effect";
import { defineHandler } from "void";
import { requireContentAdmin } from "../../../src/auth/admin.server";
import { ContentError } from "../../../src/core/errors";
import { hasMarkdownTranslationKey } from "../../../src/content/manifest.server";
import { getContent, removeContent, replaceContent } from "../../../src/content/programs.server";
import { runContentProgram } from "../../../src/content/run.server";
import {
  parseContentVersion,
  parseVersionedContentInput,
} from "../../../src/content/validation.server";
import { contentErrorResponse } from "../../../src/http/content-errors.server";
import { readJsonBody } from "../../../src/http/json-body.server";

function readContentId(id: string | undefined): string {
  if (!id) throw new ContentError({ status: 404, code: "NOT_FOUND" });
  return id;
}

export const GET = defineHandler(async (context) => {
  try {
    const isAdminView = context.req.query("view") === "admin";
    if (isAdminView) await Effect.runPromise(requireContentAdmin(context));

    const data = await runContentProgram(getContent(readContentId(context.req.param("id"))));
    if (!isAdminView && data.status !== "published") {
      throw new ContentError({ status: 404, code: "NOT_FOUND" });
    }
    return context.json({ data });
  } catch (error) {
    return contentErrorResponse(error);
  }
});

export const PUT = defineHandler(async (context) => {
  try {
    await Effect.runPromise(requireContentAdmin(context));
    const { input, version } = parseVersionedContentInput(await readJsonBody(context.req.raw));
    if (hasMarkdownTranslationKey(input.translationKey)) {
      throw new ContentError({ status: 409, code: "CONFLICT" });
    }
    const data = await runContentProgram(
      replaceContent(readContentId(context.req.param("id")), input, version),
    );
    return context.json({ data });
  } catch (error) {
    return contentErrorResponse(error);
  }
});

export const DELETE = defineHandler(async (context) => {
  try {
    await Effect.runPromise(requireContentAdmin(context));
    const version = parseContentVersion(await readJsonBody(context.req.raw));
    await runContentProgram(removeContent(readContentId(context.req.param("id")), version));
    return new Response(null, { status: 204 });
  } catch (error) {
    return contentErrorResponse(error);
  }
});
