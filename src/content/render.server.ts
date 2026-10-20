import MarkdownIt from "markdown-it";

const renderer = new MarkdownIt({ html: false });

export function renderContentMarkdown(body: string): string {
  return renderer.render(body);
}
