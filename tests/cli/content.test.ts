import { expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Schema } from "effect";
import { adminToken, baseURL } from "../local-context";
import { publishedPost } from "../fixtures/content";

const createdSchema = Schema.Struct({
  data: Schema.Struct({ id: Schema.String, version: Schema.Number }),
});
const profileSchema = Schema.Struct({
  data: Schema.Struct({ title: Schema.String, version: Schema.Number }),
});
const testProjectDir = process.env.TEST_PROJECT_DIR;

if (!testProjectDir) {
  throw new Error("TEST_PROJECT_DIR must be set by scripts/test-local.ts");
}

interface CommandResult {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
}

async function runCLI(
  args: ReadonlyArray<string>,
  env: Readonly<Record<string, string | undefined>> = {},
): Promise<CommandResult> {
  const process = Bun.spawn(
    [Bun.which("bun") ?? Bun.argv[0] ?? "bun", "scripts/content.ts", ...args],
    {
      cwd: testProjectDir,
      env: {
        ...globalThis.process.env,
        CONTENT_API_URL: baseURL,
        CONTENT_API_TOKEN: adminToken,
        ...env,
      },
      stdout: "pipe",
      stderr: "pipe",
    },
  );
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(process.stdout).text(),
    new Response(process.stderr).text(),
    process.exited,
  ]);
  return { exitCode, stdout, stderr };
}

function readCreatedRecord(output: string): Schema.Schema.Type<typeof createdSchema>["data"] {
  return Schema.decodeUnknownSync(createdSchema)(JSON.parse(output)).data;
}

test("CLI performs content create, get, update, list, delete, and Markdown import", async () => {
  const workDirectory = await mkdtemp(join(testProjectDir, ".void", "cli-content-"));
  const key = `cli-${crypto.randomUUID()}`;
  const jsonPath = join(workDirectory, "content.json");
  const markdownPath = join(workDirectory, "import.md");
  const input = { ...publishedPost, translationKey: key, slug: key };
  const invalidPath = join(workDirectory, "invalid.json");
  let created: Schema.Schema.Type<typeof createdSchema>["data"] | undefined;
  let imported: Schema.Schema.Type<typeof createdSchema>["data"] | undefined;

  try {
    await writeFile(jsonPath, JSON.stringify(input));
    await writeFile(invalidPath, "{");
    const malformed = await runCLI(["create", "--file", invalidPath]);
    expect(malformed.exitCode).toBe(2);
    expect(malformed.stdout).toBe("");

    const create = await runCLI(["create", "--file", jsonPath]);
    expect(create.exitCode).toBe(0);
    created = readCreatedRecord(create.stdout);

    const get = await runCLI(["get", created.id]);
    expect(get.exitCode).toBe(0);
    expect(Schema.decodeUnknownSync(profileSchema)(JSON.parse(get.stdout)).data.title)
      .toBe(input.title);

    await writeFile(jsonPath, JSON.stringify({ ...input, title: "Updated from CLI" }));
    const update = await runCLI([
      "update",
      created.id,
      "--file",
      jsonPath,
      "--version",
      String(created.version),
    ]);
    expect(update.exitCode).toBe(0);
    const updated = readCreatedRecord(update.stdout);
    expect(updated.version).toBe(created.version + 1);

    const stale = await runCLI([
      "update",
      created.id,
      "--file",
      jsonPath,
      "--version",
      String(created.version),
    ]);
    expect(stale.exitCode).toBe(1);
    expect(stale.stderr).not.toMatch(/SQL|secret|token/iu);

    const list = await runCLI(["list", "--locale", "vi", "--kind", "article"]);
    expect(list.exitCode).toBe(0);
    expect(list.stdout).toContain(key);

    const deleteWithoutConfirmation = await runCLI([
      "delete", created.id, "--version", String(updated.version),
    ]);
    expect(deleteWithoutConfirmation.exitCode).toBe(2);
    expect(deleteWithoutConfirmation.stderr).toContain("--yes");

    const deleted = await runCLI([
      "delete",
      created.id,
      "--version",
      String(updated.version),
      "--yes",
    ]);
    expect(deleted.exitCode).toBe(0);
    created = undefined;

    const markdown = `---
translationKey: ${key}-import
locale: vi
slug: ${key}-import
kind: article
title: Imported from CLI
description: CLI import test.
status: published
publishedAt: 2026-10-19T00:00:00.000Z
---

# Imported from CLI
`;
    await writeFile(markdownPath, markdown);
    const importedResult = await runCLI(["import", markdownPath]);
    expect(importedResult.exitCode).toBe(0);
    imported = readCreatedRecord(importedResult.stdout);

    const duplicateImport = await runCLI(["import", markdownPath]);
    expect(duplicateImport.exitCode).toBe(1);

    const apiCheck = await runCLI(["check", "--api"]);
    expect(apiCheck.exitCode).toBe(0);

    const wrongToken = "A".repeat(43);
    const unauthorized = await runCLI(["list", "--locale", "vi", "--admin"], {
      CONTENT_API_TOKEN: wrongToken,
    });
    expect(unauthorized.exitCode).toBe(1);
    expect(unauthorized.stdout).toBe("");
    expect(unauthorized.stderr).not.toContain(wrongToken);
  } finally {
    if (created) {
      await runCLI(["delete", created.id, "--version", String(created.version), "--yes"]);
    }
    if (imported) {
      await runCLI(["delete", imported.id, "--version", String(imported.version), "--yes"]);
    }
    await rm(workDirectory, { recursive: true, force: true });
  }
});

test("CLI stops redirects before a bearer token reaches another origin", async () => {
  let redirectedRequests = 0;
  const captureServer = Bun.serve({
    port: 0,
    fetch() {
      redirectedRequests += 1;
      return Response.json({ ok: true });
    },
  });
  const redirectServer = Bun.serve({
    port: 0,
    fetch() {
      return Response.redirect(`http://127.0.0.1:${captureServer.port}/capture`, 302);
    },
  });

  try {
    const result = await runCLI(["list", "--locale", "vi"], {
      CONTENT_API_URL: `http://127.0.0.1:${redirectServer.port}`,
    });
    expect(result.exitCode).toBe(1);
    expect(redirectedRequests).toBe(0);
    expect(result.stderr).not.toContain(adminToken);
  } finally {
    redirectServer.stop(true);
    captureServer.stop(true);
  }
});
