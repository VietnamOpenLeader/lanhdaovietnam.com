import { defineMiddleware } from "void";

export default defineMiddleware(async (context, next) => {
  if (context.req.method === "GET" && context.req.path === "/") {
    return context.redirect("/vi/", 302);
  }
  await next();
});
