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
  return (
    (range.through === undefined || index <= range.through) &&
    (range.after === undefined || index > range.after)
  );
}

export async function applyProjectMigrations(db: Database, range: MigrationRange): Promise<void> {
  db.exec("PRAGMA foreign_keys=ON");
  db.exec(`
    CREATE TABLE IF NOT EXISTS __test_migration_history (
      tag TEXT PRIMARY KEY
    )
  `);
  const journal = JSON.parse(await readFile(journalPath, "utf8")) as MigrationJournal;
  const entries = journal.entries.filter(({ idx }) => includesIndex(idx, range));

  for (const entry of entries) {
    const applied = db.query("SELECT 1 FROM __test_migration_history WHERE tag = ?").get(entry.tag);
    if (applied) continue;

    const migration = await readFile(join(migrationsDirectory, `${entry.tag}.sql`), "utf8");
    const statements = migration.split("--> statement-breakpoint");
    db.transaction(() => {
      for (const statement of statements) {
        const sql = statement.trim();
        if (sql.length > 0) db.exec(sql);
      }
      db.query("INSERT INTO __test_migration_history (tag) VALUES (?)").run(entry.tag);
    })();
  }
}
