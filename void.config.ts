import { defineConfig } from 'void/config';

export default defineConfig({
  "head": {
    "titleTemplate": "%s | Lãnh đạo Việt Nam",
    "htmlAttrs": { "lang": "vi" },
    "meta": [
      { "charset": "utf-8" },
      { "name": "viewport", "content": "width=device-width, initial-scale=1" },
      { "property": "og:site_name", "content": "Lãnh đạo Việt Nam" }
    ],
    "link": [
      { "rel": "icon", "href": "/favicon.svg", "type": "image/svg+xml" }
    ]
  },
  "auth": {
    "providers": ["email"]
  },
  "worker": {
    "compatibility_date": "2026-02-24",
    "compatibility_flags": ["nodejs_compat"]
  }
});
