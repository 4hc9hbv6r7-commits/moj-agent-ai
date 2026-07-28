import { createScopedClient } from "../../../lib/supabase";
import { dateIsWorkingDay, generateSlotTimes, isValidDateString, toWarsawTimestamp } from "../../../lib/slots";

async function sendOwnerNotification(params: {
  name: string;
  email: string;
  date: string;
  time: string;
  message: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  const ownerEmail = process.env.CONSULTATION_OWNER_EMAIL;
  const fromEmail = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";

  if (!apiKey || !ownerEmail) {
    console.error("Consultation booked but email not sent: RESEND_API_KEY or CONSULTATION_OWNER_EMAIL missing");
    return false;
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: ownerEmail,
        subject: `📅 Nowa rezerwacja konsultacji — ${params.date} ${params.time}`,
        text: `Nowa rezerwacja konsultacji:

Data i godzina: ${params.date} ${params.time} (Europe/Warsaw)
Imię i nazwisko: ${params.name}
Email kontaktowy: ${params.email}
Wiadomość: ${params.message || "(brak)"}`,
      }),
    });

    return response.ok;
  } catch (error) {
    console.error("Resend request failed:", error);
    return false;
  }
}

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
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const date = typeof body?.date === "string" ? body.date : "";
  const time = typeof body?.time === "string" ? body.time : "";
  const message = typeof body?.message === "string" ? body.message.trim() : "";

  if (!name || !email || !isValidDateString(date) || !time) {
    return new Response(JSON.stringify({ error: "Missing or invalid name, email, date, or time" }), { status: 400 });
  }

  if (!dateIsWorkingDay(date) || !generateSlotTimes().includes(time)) {
    return new Response(JSON.stringify({ error: "Wybrany termin nie jest dostępny" }), { status: 400 });
  }

  const scheduledAt = toWarsawTimestamp(date, time);

  if (new Date(scheduledAt).getTime() < Date.now()) {
    return new Response(JSON.stringify({ error: "Nie można zarezerwować terminu w przeszłości" }), { status: 400 });
  }

  const { error: insertError } = await db.from("consultations").insert({
    user_id: user.id,
    name,
    email,
    scheduled_at: scheduledAt,
    message: message || null,
  });

  if (insertError) {
    if (insertError.code === "23505") {
      return new Response(JSON.stringify({ error: "Ten termin został już zajęty. Wybierz inny." }), { status: 409 });
    }
    return new Response(JSON.stringify({ error: insertError.message }), { status: 500 });
  }

  const emailSent = await sendOwnerNotification({ name, email, date, time, message });

  return new Response(JSON.stringify({ saved: true, emailSent }), { status: 200 });
}
