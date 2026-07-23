import { google } from "@ai-sdk/google";
import { isStepCount, streamText } from "ai";
import { calculatorTool, readWebPageTool, searchWikipediaTool } from "../../../lib/tools";

const systemPrompt = `Jesteś profesjonalnym analitykiem biznesowym. Gdy użytkownik poda temat,
AUTONOMICZNIE zbierasz informacje i piszesz raport.

## TWÓJ PROCES:
1. Przeanalizuj temat — co trzeba zbadać?
2. Szukaj danych: Google Search, Wikipedia, strony branżowe
3. Zbierz fakty, liczby, statystyki
4. Napisz raport w profesjonalnym formacie

## FORMAT RAPORTU:

# 📊 Raport: [TEMAT]
Data: [dzisiejsza data]
Autor: Agent AI

## Streszczenie (Executive Summary)
[3-4 zdania — kluczowe wnioski]

## 1. Wprowadzenie
[Kontekst, dlaczego ten temat jest ważny]

## 2. Kluczowe dane i fakty
[Wylistowane punkty z danymi — ze źródłami]

## 3. Analiza
[Interpretacja danych, trendy, porównania]

## 4. Wnioski i rekomendacje
[Co z tego wynika? Co robić?]

## Źródła
[Lista użytych źródeł z linkami]

ZASADY:
- Używaj PRAWDZIWYCH danych — Google Search, Wikipedia
- Podawaj źródła przy każdym fakcie
- Bądź konkretny — liczby, daty, nazwy
- Raport powinien mieć 500-1000 słów
- Nie wymyślaj statystyk — szukaj!`;

const searchGroundingEnabled = process.env.ENABLE_SEARCH_GROUNDING === "true";

export async function POST(req: Request) {
  const body = await req.json();
  const topic = typeof body?.topic === "string" ? body.topic.trim() : "";

  if (!topic) {
    return new Response(JSON.stringify({ error: "Missing topic" }), { status: 400 });
  }

  const today = new Date().toLocaleDateString("pl-PL", { timeZone: "Europe/Warsaw" });

  const result = streamText({
    model: google("gemini-3.1-flash-lite"),
    system: systemPrompt,
    prompt: `Dzisiejsza data: ${today}\nTemat raportu: ${topic}`,
    tools: {
      readWebPage: readWebPageTool,
      searchWikipedia: searchWikipediaTool,
      calculator: calculatorTool,
      ...(searchGroundingEnabled ? { google_search: google.tools.googleSearch({}) } : {}),
    },
    stopWhen: isStepCount(8),
  });

  return result.toTextStreamResponse();
}
