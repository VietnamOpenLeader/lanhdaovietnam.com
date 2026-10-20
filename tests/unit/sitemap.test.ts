import { expect, test } from "bun:test";
import { escapeXML } from "../../src/seo/xml";

test("XML escaping protects all text and attribute delimiters", () => {
  expect(escapeXML(`<url a="b">&'</url>`)).toBe(
    "&lt;url a=&quot;b&quot;&gt;&amp;&apos;&lt;/url&gt;",
  );
});
