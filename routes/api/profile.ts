import { defineHandler } from "void";
import { getUser } from "void/auth";
import { env } from "void/env";

export const GET = defineHandler((context) => {
  const user = getUser();
  if (!user) {
    return context.json({ error: { code: "UNAUTHENTICATED" } }, 401);
  }
  return context.json({
    id: user.id,
    name: user.name,
    isAdmin: env.ADMIN_USER_IDS.includes(user.id),
  });
});
