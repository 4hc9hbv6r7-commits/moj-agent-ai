import { createScopedClient } from "../../../lib/supabase";

export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization");
  const accessToken = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : null;

  if (!accessToken) {
    return new Response(JSON.stringify({ error: "Missing Authorization header" }), { status: 401 });
  }

  const db = createScopedClient(accessToken);
  const {
    data: { user },
    error: authError,
  } = await db.auth.getUser();

  if (authError || !user) {
    return new Response(JSON.stringify({ error: "Invalid or expired session" }), { status: 401 });
  }

  const body = await req.json();
  const topic = typeof body?.topic === "string" ? body.topic.trim() : "";
  const content = typeof body?.content === "string" ? body.content.trim() : "";

  if (!topic || !content) {
    return new Response(JSON.stringify({ error: "Missing topic or content" }), { status: 400 });
  }

  const { error } = await db.from("reports").insert({ topic, content, user_id: user.id });

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  return new Response(JSON.stringify({ saved: true }), { status: 200 });
}
