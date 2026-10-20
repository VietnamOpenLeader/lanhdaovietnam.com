import { defineHandler } from "void";

export const GET = defineHandler(() => ({ ok: true as const }));
