import { destroySession, getCurrentUser, audit } from "@/lib/auth";

export async function POST() {
  const user = await getCurrentUser();
  if (user) await audit(user, "user.logout", "User", user.id);
  await destroySession();
  return Response.json({ ok: true });
}
