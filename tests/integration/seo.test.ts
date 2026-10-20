import { expect, test } from "bun:test";
import { Schema } from "effect";
import { adminToken, baseURL } from "../local-context";
import type { ContentInput, Locale } from "../../src/content/contracts";
import { publishedPost } from "../fixtures/content";

const savedResponseSchema = Schema.Struct({
  data: Schema.Struct({ id: Schema.String, version: Schema.Number }),
});

const translatedContent: ReadonlyArray<{
  readonly locale: Locale;
  readonly slug: string;
  readonly title: string;
}> = [
  { locale: "vi", slug: "seo-vietnamese", title: "SEO Vietnamese article" },
  { locale: "en", slug: "seo-english", title: "SEO English article" },
  { locale: "zh-CN", slug: "seo-chinese", title: "SEO Chinese article" },
];

function adminHeaders(): HeadersInit {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${adminToken}`,
  };
}

async function createContent(content: ContentInput): Promise<string> {
  const response = await fetch(`${baseURL}/api/posts`, {
    method: "POST",
    headers: adminHeaders(),
    body: JSON.stringify(content),
  });
  expect(response.status).toBe(201);
  return Schema.decodeUnknownSync(savedResponseSchema)(await response.json()).data.id;
}

async function deleteContent(id: string): Promise<void> {
  await fetch(`${baseURL}/api/posts/${id}`, {
    method: "DELETE",
    headers: adminHeaders(),
    body: JSON.stringify({ version: 1 }),
  });
}

test("localized Markdown and D1 pages have canonical, alternate, social, and JSON-LD metadata", async () => {
  const translationKey = `seo-${crypto.randomUUID()}`;
  const ids: string[] = [];
  const eventSlug = `event-${crypto.randomUUID()}`;

  try {
    for (const item of translatedContent) {
      ids.push(
        await createContent({
          ...publishedPost,
          translationKey,
          locale: item.locale,
          slug: item.slug,
          title: item.title,
          description: `Description for ${item.locale}`,
          body: `# ${item.title}`,
        }),
      );
    }
    ids.push(
      await createContent({
        ...publishedPost,
        translationKey: `event-${crypto.randomUUID()}`,
        slug: eventSlug,
        kind: "event",
        title: "Event with metadata",
        description: "Event metadata is visible.",
        startsAt: "2026-11-01T00:00:00.000Z",
        endsAt: "2026-11-02T00:00:00.000Z",
        location: "Hanoi",
        body: "# Event",
      }),
    );
    const draftSlug = `seo-draft-${crypto.randomUUID()}`;
    ids.push(
      await createContent({
        ...publishedPost,
        translationKey: `seo-draft-${crypto.randomUUID()}`,
        slug: draftSlug,
        status: "draft",
        publishedAt: null,
      }),
    );

    const markdownPages = [
      ["/vi/library/khoi-nguon", "vi", "Khởi nguồn"],
      ["/en/library/origins", "en", "Origins"],
      ["/zh-CN/library/qi-yuan", "zh-CN", "起源"],
    ] as const;
    for (const [path, locale, title] of markdownPages) {
      const response = await fetch(`${baseURL}${path}`);
      const html = await response.text();
      expect(response.status).toBe(200);
      expect(html).toContain(`<html lang="${locale}"`);
      expect(html).toContain(`<title>${title} | Lãnh đạo Việt Nam</title>`);
      expect(html.match(/rel="canonical"/gu)).toHaveLength(1);
      expect(html).toContain('name="description"');
      expect(html).toContain('property="og:title"');
      expect(html).toContain('name="twitter:card"');
      expect(html).toContain('rel="icon" href="/favicon.svg"');
      expect(html).toContain('type="application/ld+json"');
    }

    expect((await fetch(`${baseURL}/favicon.svg`)).status).toBe(200);

    for (const item of translatedContent) {
      const response = await fetch(`${baseURL}/${item.locale}/posts/${item.slug}`);
      const html = await response.text();
      expect(response.status).toBe(200);
      expect(html).toContain(`<html lang="${item.locale}"`);
      expect(html).toContain(`<title>${item.title} | Lãnh đạo Việt Nam</title>`);
      expect(html.match(/rel="canonical"/gu)).toHaveLength(1);
      for (const alternate of translatedContent) {
        expect(html).toContain(
          `hreflang="${alternate.locale}" href="https://lanhdaovietnam.com/${alternate.locale}/posts/${alternate.slug}"`,
        );
      }
    }

    const eventResponse = await fetch(`${baseURL}/vi/posts/${eventSlug}`);
    const eventHTML = await eventResponse.text();
    expect(eventResponse.status).toBe(200);
    expect(eventHTML).toContain("Hanoi");
    expect(eventHTML).toMatch(/datetime="2026-11-01T00:00:00\.000Z"/iu);
    expect(eventHTML).toContain('"@type":"Event"');

    const login = await fetch(`${baseURL}/vi/login`);
    const loginHTML = await login.text();
    expect(login.status).toBe(200);
    expect(loginHTML).toContain('name="robots" content="noindex,nofollow"');
    expect(loginHTML).not.toContain('rel="canonical"');

    const sitemapIndex = await fetch(`${baseURL}/sitemap.xml`);
    const indexXML = await sitemapIndex.text();
    expect(sitemapIndex.status).toBe(200);
    expect(sitemapIndex.headers.get("Content-Type")).toContain("application/xml");
    expect(indexXML).toContain("/sitemaps/vi-markdown-1.xml");
    expect(indexXML).toContain("/sitemaps/vi-d1-1.xml");
    expect(indexXML).toContain("/sitemaps/en-d1-1.xml");
    expect(indexXML).toContain("/sitemaps/zh-CN-d1-1.xml");

    const markdownSitemap = await fetch(`${baseURL}/sitemaps/vi-markdown-1.xml`);
    const markdownXML = await markdownSitemap.text();
    expect(markdownSitemap.status).toBe(200);
    expect(markdownXML).toContain("/vi/library/khoi-nguon");
    expect(markdownXML).not.toContain(`/vi/posts/${translatedContent[0]?.slug}`);

    const d1Sitemap = await fetch(`${baseURL}/sitemaps/vi-d1-1.xml`);
    const d1XML = await d1Sitemap.text();
    expect(d1Sitemap.status).toBe(200);
    expect(d1XML).toContain(`/vi/posts/${translatedContent[0]?.slug}`);
    expect(d1XML).not.toContain(draftSlug);
    expect(d1XML).not.toContain("/vi/login");
    expect((await fetch(`${baseURL}/sitemaps/cn-1.xml`)).status).toBe(404);
    expect((await fetch(`${baseURL}/sitemaps/vi-d1-0.xml`)).status).toBe(404);

    const robots = await fetch(`${baseURL}/robots.txt`);
    expect(robots.status).toBe(200);
    const robotsText = await robots.text();
    expect(robotsText).toContain("https://lanhdaovietnam.com/sitemap.xml");
    expect(robotsText).not.toContain(adminToken);
  } finally {
    await Promise.all(ids.map(deleteContent));
  }
});
