import { google } from "@ai-sdk/google";
import { streamText } from "ai";

const systemPrompt = `Jesteś profesjonalnym asystentem do zarządzania pocztą.

Dla KAŻDEGO maila wykonaj:
1. 📧 KATEGORYZACJA: określ typ (zapytanie ofertowe / reklamacja / spam / informacja / prośba o spotkanie)
2. 🔴🟡🟢 PRIORYTET: Wysoki (wymaga odpowiedzi dziś) / Średni (w ciągu 3 dni) / Niski (może poczekać)
3. ✍️ DRAFT: Napisz krótki, profesjonalny szkic odpowiedzi (3-5 zdań). Dla spamu nie pisz draftu.

FORMAT ODPOWIEDZI:
Dla każdego maila:

### Mail [numer]: [krótki temat]
| Kategoria | [typ] |
| Priorytet | [🔴 Wysoki / 🟡 Średni / 🟢 Niski] |
| Uzasadnienie | [dlaczego ten priorytet] |

**Proponowana odpowiedź:**
> [draft odpowiedzi]

---

Na końcu: PODSUMOWANIE
- 🔴 Pilne: [ile] maili
- 🟡 Średnie: [ile] maili
- 🟢 Niskie: [ile] maili
- ✅ Rekomendacja: [który mail obsłużyć najpierw]`;

export async function POST(req: Request) {
  const body = await req.json();
  const emails = body?.emails;

  if (!Array.isArray(emails) || emails.length === 0) {
    return new Response(JSON.stringify({ error: "Missing or invalid emails" }), { status: 400 });
  }

  const prompt = emails
    .map((email: string, index: number) => `Mail ${index + 1}:\n${email}`)
    .join("\n\n---\n\n");

  const result = streamText({
    model: google("gemini-3.1-flash-lite"),
    system: systemPrompt,
    prompt,
  });

  return result.toTextStreamResponse();
}
