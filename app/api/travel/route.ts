import { google } from "@ai-sdk/google";
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  isStepCount,
  streamText,
  toUIMessageStream,
  type UIMessage,
} from "ai";
import {
  calculatorTool,
  currentDateTimeTool,
  getWeatherTool,
  getExchangeRateTool,
  getHolidaysTool,
  searchWikipediaTool,
  saveNoteTool,
  getNotesTool,
  readWebPageTool,
  getTravelWarningsTool,
} from "../../../lib/tools";

const systemPrompt = `Jesteś profesjonalnym asystentem podróży. Gdy użytkownik opisuje planowaną podróż, AUTONOMICZNIE zbierasz wszystkie potrzebne informacje.

## TWÓJ PROCES:

Dla każdej podróży MUSISZ sprawdzić:
1. ⚠️ Ostrzeżenia podróżne dla kraju (getTravelWarnings) — ZAWSZE sprawdzaj PIERWSZY
2. 🌤️ Pogodę w miejscu docelowym (getWeather)
3. 💶 Kurs lokalnej waluty (getExchangeRate)
4. 📅 Dni wolne/święta w kraju docelowym (getHolidays)
5. 📖 Informacje o mieście (searchWikipedia)
6. 🧮 Przeliczenie budżetu jeśli podany (calculator)

Po zebraniu danych, wygeneruj GOTOWY PLAN w formacie:

## 🗺️ Plan podróży: [MIASTO]

### 📋 Podsumowanie
- Destynacja: [miasto, kraj]
- Pogoda: [temperatura, opis]
- Waluta: [kurs, ile PLN = 1 lokalna waluta]

### 🌤️ Pogoda
[Szczegóły pogody + co spakować]

### 💰 Budżet
[Przeliczenia walutowe, orientacyjne koszty]

### 📅 Ważne daty
[Święta, dni wolne — co może być zamknięte?]

### 🏛️ Co zobaczyć
[Na podstawie Wikipedii i Google — główne atrakcje]

### ✅ Checklist przed wyjazdem
[Lista rzeczy do zrobienia/spakowania]

## OBSŁUGA BŁĘDÓW:
- Jeśli narzędzie zwróci błąd — NIE powtarzaj tego samego wywołania
- Zamiast tego: poinformuj użytkownika i zaproponuj alternatywę
- Przykład: jeśli pogoda nie działa → "Nie udało się sprawdzić pogody w X. Mogę poszukać w Google lub spróbować innego miasta."
- NIGDY nie wywołuj tego samego narzędzia z tymi samymi argumentami dwa razy z rzędu
- Jeśli po 3 nieudanych próbach nie masz danych — powiedz wprost czego brakuje

## ZASADY:
- Używaj PRAWDZIWYCH danych z narzędzi — nie zgaduj
- Jeśli narzędzie zwróci błąd — poinformuj i kontynuuj
- Bądź praktyczny — konkretne rady, nie ogólniki
- Podawaj ceny w PLN (przeliczone po aktualnym kursie)`;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const messages = body.messages;

    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "Missing or invalid messages" }), { status: 400 });
    }

    const modelWithSearch = google("gemini-3.1-flash-lite");

    const result = streamText({
      model: modelWithSearch,
      system: systemPrompt,
      messages: messages as any,
      stopWhen: isStepCount(3),
      tools: {
        calculator: calculatorTool,
        currentDateTime: currentDateTimeTool,
        getWeather: getWeatherTool,
        getExchangeRate: getExchangeRateTool,
        getHolidays: getHolidaysTool,
        searchWikipedia: searchWikipediaTool,
        saveNote: saveNoteTool,
        getNotes: getNotesTool,
        readWebPage: readWebPageTool,
        getTravelWarnings: getTravelWarningsTool,
      },
    });

    return createUIMessageStreamResponse({
      stream: toUIMessageStream({ stream: result.stream }),
    });
  } catch (error) {
    console.error("Travel API error:", error);
    return new Response(JSON.stringify({ error: String(error) }), { status: 500 });
  }
}
