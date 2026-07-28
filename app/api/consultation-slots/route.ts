import { createScopedClient } from "../../../lib/supabase";
import { dateIsWorkingDay, generateSlotTimes, isValidDateString, toWarsawTimestamp } from "../../../lib/slots";

export async function GET(req: Request) {
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

  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date") ?? "";

  if (!isValidDateString(date)) {
    return new Response(JSON.stringify({ error: "Invalid or missing date (expected YYYY-MM-DD)" }), { status: 400 });
  }

  if (!dateIsWorkingDay(date)) {
    return new Response(JSON.stringify({ date, slots: [] }), { status: 200 });
  }

  const times = generateSlotTimes();
  const timestamps = times.map((time) => toWarsawTimestamp(date, time));

  const { data: existing, error } = await db
    .from("consultations")
    .select("scheduled_at")
    .in("scheduled_at", timestamps);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  const takenTimes = new Set((existing ?? []).map((row) => new Date(row.scheduled_at).getTime()));

  const slots = times.map((time, index) => ({
    time,
    available: !takenTimes.has(new Date(timestamps[index]).getTime()),
  }));

  return new Response(JSON.stringify({ date, slots }), { status: 200 });
}
