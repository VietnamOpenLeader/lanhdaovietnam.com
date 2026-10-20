import { defineHandler } from "void";

export const loader = defineHandler((context) => context.redirect("/vi/", 302));
