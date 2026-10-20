import { defineHandler } from "void";
import { Effect } from "effect";
import { requireContentAdmin } from "../../src/auth/admin.server";
import { createContent, listContent } from "../../src/content/programs.server";
import { runContentProgram } from "../../src/content/run.server";
import { parseContentInput, parseContentListQuery } from "../../src/content/validation.server";
import { contentErrorResponse } from "../../src/http/content-errors.server";
import { readJsonBody } from "../../src/http/json-body.server";

export const GET = defineHandler(async (context) => {
  try {
    const query = parseContentListQuery(new URL(context.req.url).searchParams);
    const includeDrafts = context.req.query("view") === "admin";
    if (includeDrafts) await Effect.runPromise(requireContentAdmin(context));
    const data = await runContentProgram(listContent({ ...query, includeDrafts }));
    return context.json({ data });
  } catch (error) {
    return contentErrorResponse(error);
  }
});

export const POST = defineHandler(async (context) => {
  try {
    await Effect.runPromise(requireContentAdmin(context));
    const input = parseContentInput(await readJsonBody(context.req.raw));
    const data = await runContentProgram(createContent(input));
    return context.json({ data }, 201);
  } catch (error) {
    return contentErrorResponse(error);
  }
});
