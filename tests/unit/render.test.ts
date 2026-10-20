import { expect, test } from "bun:test";
import { renderContentMarkdown } from "../../src/content/render.server";

test("D1 Markdown does not execute raw HTML or javascript URLs", () => {
  const html = renderContentMarkdown(
    '<script>alert(1)</script>\n\n[bad](javascript:alert(1))\n\n![x](x "safe")',
  );

  expect(html).not.toContain("<script>");
  expect(html).not.toMatch(/href=["']javascript:/i);
});
