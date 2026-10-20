import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Database } from "bun:sqlite";

interface MigrationEntry {
  readonly idx: number;
  readonly tag: string;
}

interface MigrationJournal {
  readonly entries: readonly MigrationEntry[];
}

interface MigrationRange {
  readonly through?: number;
  readonly after?: number;
}

const migrationsDirectory = join(import.meta.dir, "../db/migrations");
const journalPath = join(migrationsDirectory, "meta/_journal.json");

function includesIndex(index: number, range: MigrationRange): boolean {
  return (range.through === undefined || index <= range.through)
    && (range.after === undefined || index > range.after);
}

export async function applyProjectMigrations(
  db: Database,
  range: MigrationRange,
): Promise<void> {
  const journal = JSON.parse(await readFile(journalPath, "utf8")) as MigrationJournal;
  const entries = journal.entries.filter(({ idx }) => includesIndex(idx, range));

  for (const entry of entries) {
    const migration = await readFile(join(migrationsDirectory, `${entry.tag}.sql`), "utf8");
    db.exec(migration);
  }
}
