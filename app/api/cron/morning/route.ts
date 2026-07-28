import { generateMorningBriefing } from "../../../../lib/generateBriefing";

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  try {
    const briefing = await generateMorningBriefing();

    return new Response(
      JSON.stringify({ success: true, date: briefing.date, preview: briefing.content.slice(0, 200) }),
      { status: 200 }
    );
  } catch (error) {
    console.error("Morning cron error:", error);
    return new Response(JSON.stringify({ error: String(error) }), { status: 500 });
  }
}
