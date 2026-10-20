import { realpath, readFile } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { parseArgs } from "node:util";
import { Data, Effect, Schema } from "effect";
import {
  contentInputSchema,
  updateContentSchema,
} from "../src/content/contracts";
import { parseMarkdownContent } from "../src/content/frontmatter";
import {
  contentCheckResultSchema,
  type ContentCheckResult,
  type ContentMetadata,
} from "../src/content/contracts";
import { ContentApiFailure, createContentClient } from "./content-client";
import { scanLocalContent } from "./check-content";

interface ContentCLIIO {
  readonly stdout: (text: string) => void;
  readonly stderr: (text: string) => void;
}

interface ParsedArguments {
  readonly command: string | undefined;
  readonly positionals: ReadonlyArray<string>;
  readonly values: ReturnType<typeof parseCLIArguments>["values"];
}

class ContentCLIFailure extends Data.TaggedError("ContentCLIFailure")<{
  readonly exitCode: 1 | 2;
  readonly message: string;
}> {}

const commandOptions = {
  admin: { type: "boolean" },
  api: { type: "boolean" },
  cursor: { type: "string" },
  file: { type: "string" },
  help: { type: "boolean" },
  kind: { type: "string" },
  limit: { type: "string" },
  locale: { type: "string" },
  version: { type: "string" },
  yes: { type: "boolean" },
} as const;

function parseCLIArguments(argv: ReadonlyArray<string>) {
  return parseArgs({
    args: [...argv],
    options: commandOptions,
    allowPositionals: true,
    strict: true,
  });
}

function parseArguments(argv: ReadonlyArray<string>): ParsedArguments {
  try {
    const parsed = parseCLIArguments(argv);
    return {
      command: parsed.positionals[0],
      positionals: parsed.positionals.slice(1),
      values: parsed.values,
    };
  } catch {
    throw new ContentCLIFailure({
      exitCode: 2,
      message: "Invalid command arguments. Run `content --help` for usage.",
    });
  }
}

function failArguments(message: string): never {
  throw new ContentCLIFailure({ exitCode: 2, message });
}

function parsePositiveInteger(value: string | undefined, label: string): number {
  if (!value || !/^[1-9]\d*$/u.test(value)) {
    return failArguments(`Expected a positive integer for --${label}.`);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) return failArguments(`Invalid --${label} value.`);
  return parsed;
}

function assertPositionals(
  positionals: ReadonlyArray<string>,
  expected: number,
): void {
  if (positionals.length !== expected) {
    failArguments("Invalid positional arguments.");
  }
}

function assertToken(token: string | undefined): string {
  if (!token) return failArguments("CONTENT_API_TOKEN is required for this command.");
  return token;
}

function assertAllowedOptions(
  values: ParsedArguments["values"],
  allowed: ReadonlyArray<keyof typeof commandOptions>,
): void {
  const allowedOptions = new Set<string>(allowed);
  for (const key of Object.keys(values)) {
    if (key !== "help" && !allowedOptions.has(key)) {
      failArguments("An option is not valid for this command.");
    }
  }
}

function validateContent(value: unknown): unknown {
  try {
    return Schema.decodeUnknownSync(contentInputSchema, {
      onExcessProperty: "error",
    })(value);
  } catch {
    return failArguments("Content file does not match the content schema.");
  }
}

function withVersion(value: unknown, version: number): unknown {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return failArguments("Update file must contain a JSON object.");
  }
  try {
    return Schema.decodeUnknownSync(updateContentSchema, {
      onExcessProperty: "error",
    })({ ...value, version });
  } catch {
    return failArguments("Content file does not match the update schema.");
  }
}

async function readFileInsideRoot(path: string): Promise<string> {
  let realRoot: string;
  let requestedFile: string;
  try {
    realRoot = await realpath(process.cwd());
    requestedFile = isAbsolute(path) ? path : resolve(realRoot, path);
  } catch {
    return failArguments("Content file could not be read.");
  }
  if (isPublishedLibraryFile(realRoot, requestedFile)) {
    return failArguments("Files in pages/*/library cannot be imported into D1.");
  }

  let realFile: string;
  try {
    realFile = await realpath(requestedFile);
  } catch {
    return failArguments("Content file could not be read.");
  }

  if (isPublishedLibraryFile(realRoot, realFile)) {
    return failArguments("Files in pages/*/library cannot be imported into D1.");
  }
  try {
    return await readFile(realFile, "utf8");
  } catch {
    return failArguments("Content file could not be read.");
  }
}

function isPublishedLibraryFile(root: string, path: string): boolean {
  const segments = relative(root, path).split(sep);
  return segments[0] === "pages" && segments[2] === "library";
}

async function readJSONFile(path: string): Promise<unknown> {
  const content = await readFileInsideRoot(path);
  try {
    return JSON.parse(content);
  } catch {
    return failArguments("Content file must be valid JSON.");
  }
}

async function readMarkdownFile(path: string): Promise<unknown> {
  const content = await readFileInsideRoot(path);
  try {
    const parsed = parseMarkdownContent(content);
    return validateContent({ ...parsed.metadata, body: parsed.body });
  } catch {
    return failArguments("Markdown import must have valid content frontmatter.");
  }
}

function apiPathWithQuery(path: string, values: URLSearchParams): string {
  const query = values.toString();
  return query ? `${path}?${query}` : path;
}

function printJSON(io: ContentCLIIO, value: unknown): void {
  io.stdout(`${JSON.stringify(value)}\n`);
}

function buildClient(
  env: Readonly<Record<string, string | undefined>>,
  tokenRequired: boolean,
  tokenValue = env.CONTENT_API_TOKEN,
) {
  const baseURL = env.CONTENT_API_URL;
  if (!baseURL) return failArguments("CONTENT_API_URL is required.");
  const token = tokenRequired ? assertToken(tokenValue) : tokenValue;
  try {
    return createContentClient({ baseURL, ...(token ? { token } : {}) });
  } catch {
    return failArguments("Invalid CONTENT_API_URL or CONTENT_API_TOKEN configuration.");
  }
}

async function runList(
  args: ParsedArguments,
  env: Readonly<Record<string, string | undefined>>,
  io: ContentCLIIO,
): Promise<void> {
  assertPositionals(args.positionals, 0);
  assertAllowedOptions(args.values, ["locale", "kind", "limit", "cursor", "admin"]);
  const locale = args.values.locale;
  if (locale !== "vi" && locale !== "en" && locale !== "zh-CN") {
    return failArguments("list requires --locale vi, en, or zh-CN.");
  }
  if (args.values.kind !== undefined
    && args.values.kind !== "article"
    && args.values.kind !== "news"
    && args.values.kind !== "event") {
    return failArguments("Invalid --kind value.");
  }
  const limit = args.values.limit === undefined
    ? 20
    : parsePositiveInteger(args.values.limit, "limit");
  if (limit > 100) return failArguments("--limit must not exceed 100.");
  const query = new URLSearchParams({ locale, limit: String(limit) });
  if (args.values.kind) query.set("kind", args.values.kind);
  if (args.values.cursor !== undefined) query.set("cursor", args.values.cursor);
  if (args.values.admin) query.set("view", "admin");
  const client = buildClient(env, args.values.admin === true);
  printJSON(io, await client.request(apiPathWithQuery("/api/posts", query)));
}

async function runGet(
  args: ParsedArguments,
  env: Readonly<Record<string, string | undefined>>,
  io: ContentCLIIO,
): Promise<void> {
  assertPositionals(args.positionals, 1);
  assertAllowedOptions(args.values, ["admin"]);
  const id = args.positionals[0];
  if (!id) return failArguments("get requires a content ID.");
  const client = buildClient(env, args.values.admin === true);
  const query = args.values.admin ? "?view=admin" : "";
  printJSON(io, await client.request(`/api/posts/${encodeURIComponent(id)}${query}`));
}

async function runCreate(
  args: ParsedArguments,
  env: Readonly<Record<string, string | undefined>>,
  io: ContentCLIIO,
): Promise<void> {
  assertPositionals(args.positionals, 0);
  assertAllowedOptions(args.values, ["file"]);
  if (!args.values.file) return failArguments("create requires --file PATH.");
  const content = validateContent(await readJSONFile(args.values.file));
  const client = buildClient(env, true);
  printJSON(io, await client.request("/api/posts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(content),
  }));
}

async function runUpdate(
  args: ParsedArguments,
  env: Readonly<Record<string, string | undefined>>,
  io: ContentCLIIO,
): Promise<void> {
  assertPositionals(args.positionals, 1);
  assertAllowedOptions(args.values, ["file", "version"]);
  const id = args.positionals[0];
  if (!id || !args.values.file) return failArguments("update requires ID and --file PATH.");
  const version = parsePositiveInteger(args.values.version, "version");
  const content = withVersion(await readJSONFile(args.values.file), version);
  const client = buildClient(env, true);
  printJSON(io, await client.request(`/api/posts/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(content),
  }));
}

async function runDelete(
  args: ParsedArguments,
  env: Readonly<Record<string, string | undefined>>,
  io: ContentCLIIO,
): Promise<void> {
  assertPositionals(args.positionals, 1);
  assertAllowedOptions(args.values, ["version", "yes"]);
  const id = args.positionals[0];
  if (!id) return failArguments("delete requires a content ID.");
  if (!args.values.yes) return failArguments("delete requires explicit --yes confirmation.");
  const version = parsePositiveInteger(args.values.version, "version");
  const client = buildClient(env, true);
  await client.request(`/api/posts/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ version }),
  });
  printJSON(io, { deleted: true, id });
}

async function runImport(
  args: ParsedArguments,
  env: Readonly<Record<string, string | undefined>>,
  io: ContentCLIIO,
): Promise<void> {
  assertPositionals(args.positionals, 1);
  assertAllowedOptions(args.values, []);
  const path = args.positionals[0];
  if (!path) return failArguments("import requires a Markdown file path.");
  const content = await readMarkdownFile(path);
  const client = buildClient(env, true);
  printJSON(io, await client.request("/api/posts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(content),
  }));
}

async function runCheck(
  args: ParsedArguments,
  env: Readonly<Record<string, string | undefined>>,
  io: ContentCLIIO,
): Promise<void> {
  assertPositionals(args.positionals, 0);
  assertAllowedOptions(args.values, ["api"]);
  const entries = scanLocalContent().map(projectContentMetadata);
  if (!args.values.api) {
    printJSON(io, { ok: true, candidateCount: entries.length });
    return;
  }

  const client = buildClient(
    env,
    true,
    env.CONTENT_CHECK_TOKEN ?? env.CONTENT_API_TOKEN,
  );
  const deployedCheck = decodeContentCheckResult(
    await client.request("/api/content-check"),
  );
  const candidateBatches = splitCandidates(entries);
  const candidateChecks = await Promise.all(candidateBatches.map(async (batch) =>
    decodeContentCheckResult(await client.request("/api/content-check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entries: batch }),
    }))
  ));
  const candidateConflictKeys = [
    ...new Set(candidateChecks.flatMap((result) => result.conflictKeys)),
  ];
  const isClean = deployedCheck.conflictKeys.length === 0 && candidateConflictKeys.length === 0;
  printJSON(io, {
    ok: isClean,
    candidateCount: entries.length,
    deployed: deployedCheck,
    candidate: {
      checkedCount: candidateChecks.reduce((count, result) => count + result.checkedCount, 0),
      conflictKeys: candidateConflictKeys,
    },
  });
  if (!isClean) {
    throw new ContentCLIFailure({ exitCode: 1, message: "Content conflicts were found." });
  }
}

function projectContentMetadata(entry: ReturnType<typeof scanLocalContent>[number]): ContentMetadata {
  return {
    translationKey: entry.translationKey,
    locale: entry.locale,
    slug: entry.slug,
    kind: entry.kind,
    title: entry.title,
    description: entry.description,
    status: entry.status,
    publishedAt: entry.publishedAt,
    startsAt: entry.startsAt,
    endsAt: entry.endsAt,
    location: entry.location,
  };
}

function splitCandidates(entries: ReadonlyArray<ContentMetadata>): ContentMetadata[][] {
  const batchSize = 500;
  const batches: ContentMetadata[][] = [];
  for (let offset = 0; offset < entries.length; offset += batchSize) {
    batches.push(entries.slice(offset, offset + batchSize));
  }
  return batches;
}

function decodeContentCheckResult(value: unknown): ContentCheckResult {
  try {
    return Schema.decodeUnknownSync(contentCheckResultSchema, {
      onExcessProperty: "error",
    })(value);
  } catch {
    throw new ContentCLIFailure({
      exitCode: 1,
      message: "Content API returned an invalid preflight response.",
    });
  }
}

async function executeCommand(
  argv: ReadonlyArray<string>,
  io: ContentCLIIO,
  env: Readonly<Record<string, string | undefined>>,
): Promise<number> {
  const args = parseArguments(argv);
  if (args.values.help || args.command === "help") {
    io.stderr("Usage: content <list|get|create|update|delete|import|check> [options]\n");
    return 0;
  }

  const actions: Readonly<Record<string, (
    args: ParsedArguments,
    env: Readonly<Record<string, string | undefined>>,
    io: ContentCLIIO,
  ) => Promise<void>>> = {
    list: runList,
    get: runGet,
    create: runCreate,
    update: runUpdate,
    delete: runDelete,
    import: runImport,
    check: runCheck,
  };
  const action = args.command ? actions[args.command] : undefined;
  if (!action) return failArguments("Unknown content command.");
  await action(args, env, io);
  return 0;
}

export function runContentCLI(
  argv: ReadonlyArray<string>,
  io: ContentCLIIO,
  env: Readonly<Record<string, string | undefined>>,
): Promise<number> {
  const program = Effect.tryPromise({
    try: () => executeCommand(argv, io, env),
    catch: (error) => error instanceof ContentCLIFailure
      ? error
      : new ContentCLIFailure({
        exitCode: 1,
        message: error instanceof ContentApiFailure
          ? `Content API request failed (${error.code}).`
          : "Content command failed.",
      }),
  }).pipe(Effect.catch((error) => Effect.sync(() => {
    io.stderr(`${error.message}\n`);
    return error.exitCode;
  })));

  return Effect.runPromise(program);
}

if (import.meta.main) {
  process.exitCode = await runContentCLI(
    process.argv.slice(2),
    {
      stdout: (text) => process.stdout.write(text),
      stderr: (text) => process.stderr.write(text),
    },
    process.env,
  );
}
