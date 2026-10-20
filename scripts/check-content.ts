import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative, sep } from "node:path";
import type { VoidMdPage } from "@void/md/pages";
import { ContentError } from "../src/core/errors";
import {
  MarkdownFrontmatterError,
  maxMarkdownSourceBytes,
  parseMarkdownContent,
} from "../src/content/frontmatter";
import { buildMarkdownIndex } from "../src/content/markdown";
import type { ContentMetadata } from "../src/content/contracts";

const pagesRoot = join(import.meta.dir, "..", "pages");
const contentFolders = ["vi/library", "en/library", "zh-CN/library"] as const;

function collectMarkdownFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isSymbolicLink()) return [];
    if (entry.isDirectory()) return collectMarkdownFiles(path);
    return entry.isFile() && extname(entry.name) === ".md" ? [path] : [];
  });
}

function toManifestPage(file: string): VoidMdPage {
  if (statSync(file).size > maxMarkdownSourceBytes) {
    throw contentProblem(file);
  }
  const filePath = relative(pagesRoot, file).split(sep).join("/");
  const route = `/${filePath.slice(0, -extname(file).length)}`;
  let metadata: ContentMetadata;
  try {
    metadata = parseMarkdownContent(readFileSync(file, "utf8")).metadata;
  } catch (error) {
    if (error instanceof MarkdownFrontmatterError) {
      throw contentProblem(file);
    }
    throw error;
  }
  return {
    path: route,
    title: metadata.title,
    frontmatter: { ...metadata },
    headings: [],
  };
}

function contentProblem(file: string): ContentError {
  const sourcePath = relative(pagesRoot, file).split(sep).join("/");
  return new ContentError({
    status: 422,
    code: "VALIDATION",
    fields: { slug: sourcePath },
  });
}

function collectPublishedPages(): VoidMdPage[] {
  return contentFolders.flatMap((folder) => {
    const directory = join(pagesRoot, folder);
    return collectMarkdownFiles(directory).map(toManifestPage);
  });
}

function main(): void {
  const files = contentFolders.flatMap((folder) => collectMarkdownFiles(join(pagesRoot, folder)));
  if (files.length === 0) {
    throw new Error("No published Markdown files found under localized library folders");
  }
  const index = buildMarkdownIndex(collectPublishedPages());
  console.log(`Validated ${index.length} published Markdown page(s).`);
}

try {
  main();
} catch (error) {
  if (error instanceof ContentError) {
    console.error(`Content validation failed: ${error.code}`, error.fields ?? {});
  } else if (error instanceof Error) {
    console.error(`Content validation failed: ${error.message}`);
  } else {
    console.error("Content validation failed: Unknown error");
  }
  process.exitCode = 1;
}
