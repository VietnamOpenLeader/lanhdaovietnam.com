import tailwindcss from "@tailwindcss/vite";
import { voidMarkdown } from "@void/md/plugin";
import { voidReact } from "@void/react/plugin";
import { defineConfig } from "vite-plus";
import { voidPlugin } from "void";

export default defineConfig({
  fmt: {
    ignorePatterns: [
      "db/migrations/meta/**",
      "docs/plans/2026-10-19-*.md",
      "docs/specs/2026-10-19-*.md",
      "src/locales/*/messages.json",
    ],
  },
  lint: {
    ignorePatterns: ["src/routes/__root.tsx"],
  },
  plugins: [voidPlugin(), voidReact(), voidMarkdown(), tailwindcss()],
});
