import { ContentError } from "../core/errors";
import type { ContentMetadata } from "./contracts";
import { findForTranslationKeys } from "./programs.server";
import { runContentProgram } from "./run.server";

export interface ContentConflictResult {
  readonly checkedCount: number;
  readonly conflictKeys: ReadonlyArray<string>;
}

const maxManifestKeys = 10_000;
const translationKeyBatchSize = 500;

interface TranslationGroup {
  readonly kind: ContentMetadata["kind"];
  readonly locales: Set<ContentMetadata["locale"]>;
}

function uniqueTranslationKeys(entries: ReadonlyArray<ContentMetadata>): string[] {
  return [...new Set(entries.map((entry) => entry.translationKey))];
}

function assertUniqueCandidateTranslations(entries: ReadonlyArray<ContentMetadata>): void {
  const groups = new Map<string, TranslationGroup>();
  for (const entry of entries) {
    const group = groups.get(entry.translationKey);
    if (!group) {
      groups.set(entry.translationKey, {
        kind: entry.kind,
        locales: new Set([entry.locale]),
      });
      continue;
    }
    if (group.kind !== entry.kind || group.locales.has(entry.locale)) {
      throw new ContentError({ status: 422, code: "VALIDATION" });
    }
    group.locales.add(entry.locale);
  }
}

function splitBatches<T>(items: ReadonlyArray<T>, batchSize: number): T[][] {
  const batches: T[][] = [];
  for (let offset = 0; offset < items.length; offset += batchSize) {
    batches.push(items.slice(offset, offset + batchSize));
  }
  return batches;
}

export async function checkContentConflicts(
  entries: ReadonlyArray<ContentMetadata>,
): Promise<ContentConflictResult> {
  assertUniqueCandidateTranslations(entries);
  if (entries.some((entry) => entry.status !== "published")) {
    throw new ContentError({ status: 422, code: "VALIDATION" });
  }

  const translationKeys = uniqueTranslationKeys(entries);
  if (translationKeys.length > maxManifestKeys) {
    throw new ContentError({ status: 413, code: "TOO_LARGE" });
  }
  const batches = splitBatches(translationKeys, translationKeyBatchSize);
  const existing = await Promise.all(
    batches.map((batch) => runContentProgram(findForTranslationKeys(batch))),
  );
  const existingKeys = new Set(existing.flatMap((rows) => rows.map((row) => row.translationKey)));

  return {
    checkedCount: entries.length,
    conflictKeys: translationKeys.filter((key) => existingKeys.has(key)),
  };
}
