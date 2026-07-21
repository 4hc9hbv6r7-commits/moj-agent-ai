import { google } from "@ai-sdk/google";
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  isStepCount,
  streamText,
  toUIMessageStream,
  type UIMessage,
} from "ai";

type ChatModel = "flash";

const modelMap: Record<ChatModel, string> = {
  flash: "gemini-3.1-flash-lite",
};

function isChatModel(model: unknown): model is ChatModel {
  return model === "flash";
}

const thinkingPrompt = `Jestes analitykiem. Twoim zadaniem jest MYSLEC NA GLOS.

Gdy dostajesz pytanie, MUSISZ przejsc przez te kroki:

### 🧠 MYŚLĘ...

**Krok 1 — Zrozumienie:**
Co dokładnie użytkownik pyta? Przeformułuj pytanie swoimi słowami.

**Krok 2 — Fakty:**
Co wiem na ten temat? Co jest pewne, a co wymaga sprawdzenia?

**Krok 3 — Analiza:**
Jakie są 2-3 możliwe podejścia lub odpowiedzi?

**Krok 4 — Ocena:**
Które podejście jest najlepsze? DLACZEGO?

### ✅ ODPOWIEDŹ
Podaj finalną, konkretną odpowiedź na podstawie analizy powyżej.

WAŻNE:
- ZAWSZE pokazujesz cały proces myślenia.
- Używasz nagłówków markdown do oddzielenia kroków.
- Część "MYŚLĘ" ma być dłuższa niż finalna odpowiedź.`;

export async function POST(req: Request) {
  const {
    messages,
    model = "flash",
  }: { messages: UIMessage[]; model?: unknown } = await req.json();
  const selectedModel = isChatModel(model) ? model : "flash";

  const result = streamText({
    model: google(modelMap[selectedModel]),
    system: thinkingPrompt,
    messages: await convertToModelMessages(messages),
    stopWhen: isStepCount(3),
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({ stream: result.stream }),
  });
}
