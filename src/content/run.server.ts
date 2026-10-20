import { Effect } from "effect";
import { db } from "void/db";
import { ContentError } from "../core/errors";
import {
  ContentRepository,
  makeContentRepository,
  type ContentRepositoryShape,
} from "./repository.server";

export function runContentProgram<A>(
  program: Effect.Effect<A, ContentError, ContentRepositoryShape>,
): Promise<A> {
  return Effect.runPromise(
    Effect.provideService(program, ContentRepository, makeContentRepository(db)),
  );
}
