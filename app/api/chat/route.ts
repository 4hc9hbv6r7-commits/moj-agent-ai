import { google } from "@ai-sdk/google";
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  isStepCount,
  streamText,
  toUIMessageStream,
  tool,
  type UIMessage,
} from "ai";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createScopedClient } from "../../../lib/supabase";

type ChatModel = "flash";

const systemPrompt = `# Aneta Sentinel — Starsza analityczka Threat Intelligence i SOC

## KIM JESTEM
Jestem starszą analityczką threat intelligence z 9-letnim doświadczeniem w cyberbezpieczeństwie.
Specjalizuję się w analizie phishingu i kampanii ransomware, OSINT i korelacji IOC/TTP oraz operacyjnym triage incydentów.
Pracowałam z zespołami SOC w firmach technologicznych, e-commerce i usługach finansowych.
To moja specjalizacja, ale nie ogranicza mnie do niej — swobodnie rozmawiam też na inne tematy, zachowując profesjonalny ton.

## JAK ODPOWIADAM

### Struktura każdej odpowiedzi (tematy bezpieczeństwa/IT):
1. 📋 **Kontekst** — potwierdzam zrozumienie pytania (1 zdanie)
2. 🔍 **Analiza** — merytoryczna odpowiedź (max 2 akapity)
3. ✅ **Rekomendacja** — konkretne działanie do podjęcia (1-3 punkty)
4. ❓ **Pytanie** — jedno pytanie pogłębiające do użytkownika

Gdy pytanie NIE dotyczy bezpieczeństwa/IT — odpowiadam swobodniej, bez wymuszania powyższej
struktury ani sekcji Severity/IOC/Mitigacje, ale zachowuję rzeczowy, profesjonalny ton.

### Zasady:
- ZANIM odpowiem na złożone pytanie — pytam o kontekst.
- Gdy podaję fakty — oznaczam pewność: ✓ pewne, ~ przybliżone, ? do weryfikacji.
- **Pogrubiam** kluczowe terminy przy pierwszym użyciu.
- Używam list numerowanych dla kroków, punktowanych dla opcji.
- Maksymalnie 3 akapity + rekomendacja.
- Gdy pytanie dotyczy incydentu, używam sekcji: Severity, IOC, Mitigacje, Next Step.
- Severity oceniam jako: Low, Medium, High lub Critical i krótko uzasadniam.
- Po sekcji Next Step dodaję krótką tabelę ryzyka: Wpływ | Prawdopodobieństwo | Priorytet.

### Styl:
- Język: polski
- Ton: profesjonalny, bezpośredni i operacyjny
- Gdy używam terminu branżowego — wyjaśniam go krótko w nawiasie

## CZEGO NIE ROBIĘ
- Nie udaję, że wiem coś, czego nie wiem.
- Nie udzielam porad prawnych, medycznych lub inwestycyjnych; odsyłam do specjalisty.

## PAMIĘĆ
- Pamiętasz całą rozmowę od początku i nawiązujesz do wcześniejszego kontekstu.
- Jeśli użytkownik poda imię, używasz go konsekwentnie.
- Dla komend "podsumuj", "podsumuj rozmowę" lub "co ustaliliśmy" zwracasz numerowane podsumowanie tematów, ustaleń i kolejnych kroków.`;

const modelMap: Record<ChatModel, string> = {
  flash: "gemini-3.1-flash-lite",
};

function isChatModel(model: unknown): model is ChatModel {
  return model === "flash";
}

function getTextFromParts(parts: Array<{ type: string; text?: string }>) {
  return parts
    .filter((part) => part.type === "text")
    .map((part) => part.text ?? "")
    .join("");
}

const readWebPageTool = {
  description:
    "Pobiera i czyta zawartość strony internetowej. Używaj gdy chcesz przeczytać artykuł znaleziony w wyszukiwarce.",
  inputSchema: z.object({
    url: z.string().url("Musisz podać pełny URL"),
  }),
  execute: async ({ url }: { url: string }): Promise<string> => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(url, {
        signal: controller.signal,
        headers: { "User-Agent": "Mozilla/5.0" },
      });

      clearTimeout(timeout);

      if (!response.ok) {
        return `Błąd: ${response.status} ${response.statusText}`;
      }

      let html = await response.text();

      html = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
      html = html.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "");
      html = html.replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, "");
      html = html.replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, "");

      let text = html.replace(/<[^>]*>/g, "");

      text = text
        .replace(/&nbsp;/g, " ")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");

      text = text.replace(/\s+/g, " ").trim();

      return text.slice(0, 3000);
    } catch (error) {
      if (error instanceof Error && error.message.includes("AbortError")) {
        return `Timeout: strona nie odpowiada w ciągu 5 sekund`;
      }
      return `Błąd: ${error instanceof Error ? error.message : String(error)}`;
    }
  },
};

const generateImageTool = {
  description:
    "Generuje obraz na podstawie opisu. Używaj gdy użytkownik prosi o logo, grafikę, ilustrację.",
  inputSchema: z.object({
    prompt: z.string().min(10, "Opis musi mieć co najmniej 10 znaków"),
  }),
  execute: async ({ prompt }: { prompt: string }): Promise<string> => {
    try {
      const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
      if (!apiKey) throw new Error("GOOGLE_GENERATIVE_AI_API_KEY not set");

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-image:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                parts: [{ text: prompt }],
              },
            ],
            generationConfig: {
              responseModalities: ["TEXT", "IMAGE"],
            },
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      const candidates = data.candidates?.[0];
      if (!candidates) {
        return "Błąd: nie udało się wygenerować obrazu";
      }

      let imageBase64 = "";
      let text = "";

      for (const part of candidates.content?.parts || []) {
        if (part.inlineData?.data) {
          imageBase64 = part.inlineData.data;
        }
        if (part.text) {
          text = part.text;
        }
      }

      if (!imageBase64) {
        return "Błąd: nie udało się wygenerować obrazu";
      }

      return `[IMAGE]data:image/png;base64,${imageBase64}[/IMAGE]\n${text}`;
    } catch (error) {
      return `Błąd generowania: ${error instanceof Error ? error.message : String(error)}`;
    }
  },
};

function createSaveUserNameTool(db: SupabaseClient, userId: string) {
  return {
    description: "Zapisuje imię użytkownika w jego profilu. Wywołaj gdy użytkownik poda swoje imię.",
    inputSchema: z.object({
      name: z.string().min(1, "Podaj imię"),
    }),
    execute: async ({ name }: { name: string }): Promise<string> => {
      const { error } = await db.from("user_profiles").update({ name }).eq("id", userId);

      if (error) {
        return JSON.stringify({ error: error.message });
      }

      return JSON.stringify({ saved: true, name });
    },
  };
}

function createSaveUserPreferenceTool(db: SupabaseClient, userId: string) {
  return {
    description:
      "Zapisuje preferencję użytkownika (np. ulubione jedzenie, miasto) w jego profilu. Wywołaj gdy użytkownik wspomni o swoich upodobaniach.",
    inputSchema: z.object({
      key: z.string().min(1).describe("Klucz preferencji, np. 'ulubione_jedzenie', 'miasto'"),
      value: z.string().min(1).describe("Wartość preferencji, np. 'pizza', 'Kraków'"),
    }),
    execute: async ({ key, value }: { key: string; value: string }): Promise<string> => {
      const { data: profile, error: fetchError } = await db
        .from("user_profiles")
        .select("preferences")
        .eq("id", userId)
        .maybeSingle();

      if (fetchError) {
        return JSON.stringify({ error: fetchError.message });
      }

      const preferences = { ...(profile?.preferences ?? {}), [key]: value };

      const { error: updateError } = await db
        .from("user_profiles")
        .update({ preferences })
        .eq("id", userId);

      if (updateError) {
        return JSON.stringify({ error: updateError.message });
      }

      return JSON.stringify({ saved: true, key, value });
    },
  };
}

function prepareMessages(messages: UIMessage[], imageBase64?: string): any[] {
  return messages.map((msg) => {
    if (msg.role === "user" && imageBase64) {
      return {
        role: "user",
        content: [
          {
            type: "image",
            image: imageBase64,
          },
          {
            type: "text",
            text: getTextFromParts(msg.parts),
          },
        ],
      };
    }
    return {
      role: msg.role,
      content: getTextFromParts(msg.parts),
    };
  });
}

export async function POST(req: Request) {
  try {
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
    const { messages, model = "flash", image } = body;
    const selectedModel = isChatModel(model) ? model : "flash";

    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "Missing or invalid messages" }), { status: 400 });
    }

    const { data: profile } = await db
      .from("user_profiles")
      .select("name")
      .eq("id", user.id)
      .maybeSingle();

    const personalizationPrompt = profile?.name
      ? `\n\nUżytkownik ma na imię ${profile.name}. Zwracaj się do niego po imieniu. Bądź ciepły i personalny — to Twój stały użytkownik.`
      : "\n\nTo nowy użytkownik. Na początku pierwszej rozmowy przywitaj się krótko i zapytaj jak ma na imię. Gdy poda imię — użyj narzędzia saveUserName żeby je zapamiętać. Gdy wspomni o swoich preferencjach (jedzenie, miasto, zainteresowania) — zapisz je narzędziem saveUserPreference.";

    const result = streamText({
      model: google(modelMap[selectedModel]),
      system: systemPrompt + personalizationPrompt,
      messages: image ? prepareMessages(messages, image) : await convertToModelMessages(messages as UIMessage[]),
      tools: {
        readWebPage: readWebPageTool,
        generateImage: generateImageTool,
        saveUserName: createSaveUserNameTool(db, user.id),
        saveUserPreference: createSaveUserPreferenceTool(db, user.id),
      },
      stopWhen: isStepCount(3),
    });

    return createUIMessageStreamResponse({
      stream: toUIMessageStream({ stream: result.stream }),
    });
  } catch (error) {
    console.error("Chat API error:", error);
    return new Response(JSON.stringify({ error: String(error) }), { status: 500 });
  }
}
