import { createScopedClient } from "../../../../lib/supabase";
import { generateMorningBriefing } from "../../../../lib/generateBriefing";

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

  try {
    const briefing = await generateMorningBriefing();
    return new Response(JSON.stringify({ success: true, briefing }), { status: 200 });
  } catch (error) {
    console.error("Manual briefing generation error:", error);
    return new Response(JSON.stringify({ error: String(error) }), { status: 500 });
  }
}
