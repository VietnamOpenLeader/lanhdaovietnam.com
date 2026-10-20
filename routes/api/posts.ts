import { defineHandler } from "void";
import { Effect } from "effect";
import { requireContentAdmin } from "../../src/auth/admin.server";
import { listCatalog } from "../../src/content/catalog.server";
import { ContentError } from "../../src/core/errors";
import { createContent, listContent } from "../../src/content/programs.server";
import { hasMarkdownTranslationKey } from "../../src/content/manifest.server";
import { runContentProgram } from "../../src/content/run.server";
import { parseContentInput, parseContentListQuery } from "../../src/content/validation.server";
import { contentErrorResponse } from "../../src/http/content-errors.server";
import { readJsonBody } from "../../src/http/json-body.server";

export const GET = defineHandler(async (context) => {
  try {
    const { cursor, ...query } = parseContentListQuery(new URL(context.req.url).searchParams);
    const includeDrafts = context.req.query("view") === "admin";
    if (includeDrafts) {
      await Effect.runPromise(requireContentAdmin(context));
      if (cursor !== undefined) {
        throw new ContentError({ status: 400, code: "VALIDATION" });
      }
      const data = await runContentProgram(listContent({ ...query, includeDrafts }));
      return context.json({
        data: data.map((record) => ({ ...record, source: "d1" })),
        nextCursor: null,
      });
    }

    const page = await listCatalog({
      ...query,
      ...(cursor === undefined ? {} : { cursor }),
    });
    return context.json({ data: page.items, nextCursor: page.nextCursor });
  } catch (error) {
    return contentErrorResponse(error);
  }
});

export const POST = defineHandler(async (context) => {
  try {
    await Effect.runPromise(requireContentAdmin(context));
    const input = parseContentInput(await readJsonBody(context.req.raw));
    if (hasMarkdownTranslationKey(input.translationKey)) {
      throw new ContentError({ status: 409, code: "CONFLICT" });
    }
    const data = await runContentProgram(createContent(input));
    return context.json({ data }, 201);
  } catch (error) {
    return contentErrorResponse(error);
  }
});
