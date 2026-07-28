import { google } from "@ai-sdk/google";
import { generateText } from "ai";
import { supabase } from "../../../../lib/supabase";
import { getWeatherTool, getExchangeRateTool, currentDateTimeTool } from "../../../../lib/tools";

const systemPrompt = `Jesteś osobistym asystentem. Napisz poranny briefing w formacie:

# ☀️ Dzień dobry! Twój briefing na [data]

## 🌤️ Pogoda
[temperatura, opis, co ubrać]

## 💶 Kursy walut
- EUR: [kurs] PLN
- USD: [kurs] PLN

## 📅 Dzisiejszy dzień
- Dzień tygodnia: [...]
- Uwagi: [czy dziś święto? dzień wolny?]

## 💡 Porada dnia
[Krótka, pozytywna porada na dzień]`;

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  try {
    const [weatherRaw, eurRaw, usdRaw, dateRaw] = await Promise.all([
      getWeatherTool.execute({ city: "Warszawa" }),
      getExchangeRateTool.execute({ currency: "EUR" }),
      getExchangeRateTool.execute({ currency: "USD" }),
      currentDateTimeTool.execute(),
    ]);

    const weather = JSON.parse(weatherRaw);
    const eur = JSON.parse(eurRaw);
    const usd = JSON.parse(usdRaw);
    const dateTime = JSON.parse(dateRaw);

    const { text } = await generateText({
      model: google("gemini-3.1-flash-lite"),
      system: systemPrompt,
      prompt: `Dane na dziś:
- Data i godzina: ${dateTime.dateTime}
- Dzień tygodnia: ${dateTime.dayOfWeek}
- Pogoda w Warszawie: ${JSON.stringify(weather)}
- Kurs EUR: ${JSON.stringify(eur)}
- Kurs USD: ${JSON.stringify(usd)}

Napisz briefing na podstawie tych danych.`,
    });

    const date = new Date().toISOString().slice(0, 10);

    const { error } = await supabase.from("briefings").insert({ content: text, date });

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }

    return new Response(
      JSON.stringify({ success: true, date, preview: text.slice(0, 200) }),
      { status: 200 }
    );
  } catch (error) {
    console.error("Morning cron error:", error);
    return new Response(JSON.stringify({ error: String(error) }), { status: 500 });
  }
}
