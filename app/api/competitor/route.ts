import { google } from "@ai-sdk/google";
import { isStepCount, streamText } from "ai";
import { readWebPageTool, searchWikipediaTool } from "../../../lib/tools";

const systemPrompt = `Jesteś analitykiem konkurencji. Gdy użytkownik poda nazwy firm,
AUTONOMICZNIE zbierasz informacje i porównujesz je.

## TWÓJ PROCES:
1. Dla KAŻDEJ firmy: szukaj informacji (Google, Wikipedia, strony firmowe)
2. Zbierz: opis, branża, wielkość, produkty, ceny, mocne/słabe strony
3. Stwórz tabelę porównawczą
4. Napisz rekomendację

## FORMAT:

# 🏢 Analiza konkurencji

## Porównanie

| Aspekt | [Firma 1] | [Firma 2] | [Firma 3] |
|--------|-----------|-----------|-----------|
| Branża | ... | ... | ... |
| Wielkość | ... | ... | ... |
| Główny produkt | ... | ... | ... |
| Mocne strony | ... | ... | ... |
| Słabe strony | ... | ... | ... |
| Ceny (orientacyjne) | ... | ... | ... |

## Szczegółowa analiza
[Rozwinięcie dla każdej firmy — 3-4 zdania]

## Rekomendacja
[Która firma jest najlepsza i dlaczego — w kontekście użytkownika]

## Źródła
[Linki do stron firmowych i artykułów]`;

const searchGroundingEnabled = process.env.ENABLE_SEARCH_GROUNDING === "true";

export async function POST(req: Request) {
  const body = await req.json();
  const companies = Array.isArray(body?.companies)
    ? body.companies.map((c: unknown) => (typeof c === "string" ? c.trim() : "")).filter(Boolean)
    : [];
  const context = typeof body?.context === "string" ? body.context.trim() : "";

  if (companies.length < 2) {
    return new Response(JSON.stringify({ error: "Provide at least 2 companies" }), { status: 400 });
  }

  const prompt = [
    `Firmy do porównania: ${companies.join(", ")}`,
    context ? `Kontekst użytkownika: ${context}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const result = streamText({
    model: google("gemini-3.1-flash-lite"),
    system: systemPrompt,
    prompt,
    tools: {
      readWebPage: readWebPageTool,
      searchWikipedia: searchWikipediaTool,
      ...(searchGroundingEnabled ? { google_search: google.tools.googleSearch({}) } : {}),
    },
    stopWhen: isStepCount(10),
  });

  return result.toTextStreamResponse();
}
