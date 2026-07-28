import { google } from "@ai-sdk/google";
import { generateText } from "ai";
import { supabase } from "./supabase";
import { getWeatherTool, getExchangeRateTool, currentDateTimeTool } from "./tools";

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

export interface Briefing {
  id: string;
  content: string;
  date: string;
  created_at: string;
}

export async function generateMorningBriefing(): Promise<Briefing> {
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

  const { data, error } = await supabase
    .from("briefings")
    .insert({ content: text, date })
    .select("id, content, date, created_at")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}
