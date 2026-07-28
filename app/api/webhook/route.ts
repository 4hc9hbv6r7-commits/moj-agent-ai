import { google } from "@ai-sdk/google";
import { generateText } from "ai";
import { supabase } from "../../../lib/supabase";

type WebhookType = "feedback" | "alert" | "order";

function isWebhookType(type: unknown): type is WebhookType {
  return type === "feedback" || type === "alert" || type === "order";
}

const systemPrompts: Record<WebhookType, string> = {
  feedback: `Jesteś analitykiem obsługi klienta. Otrzymujesz feedback klienta w formacie JSON.
Przeanalizuj go i zwróć zwięzłą analizę w formacie:

Sentiment: [pozytywny/neutralny/negatywny]
Priorytet: [niski/średni/wysoki]
Sugerowana odpowiedź: [krótki szkic odpowiedzi do klienta, 1-2 zdania]`,
  alert: `Jesteś inżynierem SRE analizującym alert systemowy w formacie JSON.
Przeanalizuj go i zwróć:

Severity: [Low/Medium/High/Critical]
Prawdopodobna przyczyna: [krótkie wyjaśnienie]
Zalecana akcja: [konkretne kroki do podjęcia]`,
  order: `Jesteś asystentem potwierdzającym zamówienia. Otrzymujesz dane zamówienia w formacie JSON.
Napisz krótkie, przyjazne podsumowanie potwierdzające zamówienie (produkt, klient, kwota).`,
};

export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.WEBHOOK_SECRET}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  try {
    const body = await req.json();
    const { type, data } = body ?? {};

    if (!isWebhookType(type)) {
      return new Response(
        JSON.stringify({ error: "Nieobsługiwany typ zdarzenia. Obsługiwane: feedback, alert, order" }),
        { status: 400 }
      );
    }

    if (!data || typeof data !== "object") {
      return new Response(JSON.stringify({ error: "Brak lub nieprawidłowe pole 'data'" }), { status: 400 });
    }

    const { text: analysis } = await generateText({
      model: google("gemini-3.1-flash-lite"),
      system: systemPrompts[type],
      prompt: `Dane zdarzenia:\n${JSON.stringify(data, null, 2)}`,
    });

    const { data: inserted, error } = await supabase
      .from("webhook_events")
      .insert({ type, data, analysis })
      .select("id")
      .single();

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }

    return new Response(
      JSON.stringify({ success: true, analysis, event_id: inserted.id }),
      { status: 200 }
    );
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(JSON.stringify({ error: String(error) }), { status: 500 });
  }
}
