import { Data, Schema } from "effect";
import matter from "gray-matter";
import { isAlias, isMap, isPair, isScalar, isSeq, parseDocument, type Node, type Pair } from "yaml";
import { contentMetadataSchema, type ContentMetadata } from "./contracts";

const maxYamlAliasCount = 20;
export const maxMarkdownSourceBytes = 256 * 1024;
const standardYamlTags = new Set([
  "tag:yaml.org,2002:map",
  "tag:yaml.org,2002:seq",
  "tag:yaml.org,2002:str",
  "tag:yaml.org,2002:null",
  "tag:yaml.org,2002:bool",
  "tag:yaml.org,2002:int",
  "tag:yaml.org,2002:float",
]);
const strictYamlOptions = {
  version: "1.2",
  strict: true,
  uniqueKeys: true,
  stringKeys: true,
  resolveKnownTags: false,
} as const;

export class MarkdownFrontmatterError extends Data.TaggedError("MarkdownFrontmatterError")<{
  readonly code: "TOO_LARGE" | "INVALID_FRONTMATTER";
}> {}

export interface ParsedMarkdownContent {
  readonly metadata: ContentMetadata;
  readonly body: string;
}

function hasUnsafeYamlTag(node: Node | Pair<Node, Node>): boolean {
  if (isPair<Node, Node>(node)) {
    return hasUnsafeYamlTag(node.key) || (node.value !== null && hasUnsafeYamlTag(node.value));
  }
  if (isAlias(node)) return false;
  if (isScalar(node)) return node.tag !== undefined && !standardYamlTags.has(node.tag);
  if (isMap<Node, Node>(node)) {
    return (
      (node.tag !== undefined && !standardYamlTags.has(node.tag)) ||
      node.items.some((pair) => hasUnsafeYamlTag(pair))
    );
  }
  if (isSeq<Node>(node)) {
    return (
      (node.tag !== undefined && !standardYamlTags.has(node.tag)) ||
      node.items.some((item) => hasUnsafeYamlTag(item))
    );
  }
  return false;
}

function parseYamlFrontmatter(source: string): object {
  const document = parseDocument(source, strictYamlOptions);
  if (
    document.errors.length > 0 ||
    (document.contents !== null && hasUnsafeYamlTag(document.contents))
  ) {
    throw new MarkdownFrontmatterError({ code: "INVALID_FRONTMATTER" });
  }
  const value = document.toJS({ maxAliasCount: maxYamlAliasCount });
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new MarkdownFrontmatterError({ code: "INVALID_FRONTMATTER" });
  }
  return value;
}

function parseFrontmatter(source: string): { data: object; content: string } {
  const parsed = matter(source, {
    language: "yaml",
    engines: { yaml: parseYamlFrontmatter },
  });
  if (parsed.language !== "yaml") {
    throw new MarkdownFrontmatterError({ code: "INVALID_FRONTMATTER" });
  }
  return {
    data: {
      ...parsed.data,
      publishedAt: parsed.data.publishedAt ?? null,
      startsAt: parsed.data.startsAt ?? null,
      endsAt: parsed.data.endsAt ?? null,
      location: parsed.data.location ?? null,
    },
    content: parsed.content,
  };
}

function decodeMetadata(input: object): ContentMetadata {
  try {
    return Schema.decodeUnknownSync(contentMetadataSchema, {
      onExcessProperty: "error",
    })(input);
  } catch {
    throw new MarkdownFrontmatterError({ code: "INVALID_FRONTMATTER" });
  }
}

function removeOpeningLineBreak(body: string): string {
  return body.replace(/^(?:\r?\n)+/u, "");
}

export function parseMarkdownContent(source: string): ParsedMarkdownContent {
  if (new TextEncoder().encode(source).byteLength > maxMarkdownSourceBytes) {
    throw new MarkdownFrontmatterError({ code: "TOO_LARGE" });
  }
  const parsed = parseFrontmatter(source);
  return {
    metadata: decodeMetadata(parsed.data),
    body: removeOpeningLineBreak(parsed.content),
  };
}
