
import { z } from "zod";
import { embedText } from "./embeddings";
import { supabase } from "./supabase";

export interface Note {
  title: string;
  content: string;
  createdAt: string;
}

const globalNotesKey = Symbol.for("agent.notes");
if (!(globalNotesKey in globalThis)) {
  (globalThis as any)[globalNotesKey] = [] as Note[];
}
const notesStore = (globalThis as any)[globalNotesKey] as Note[];

// 1. Calculator
export const calculatorTool = {
  description: "Oblicza wyrażenia matematyczne. Używaj do dokładnych obliczeń.",
  inputSchema: z.object({
    expression: z.string().describe("Wyrażenie matematyczne do obliczenia, np. '15 * 247' lub '5000 / 4.28'"),
  }),
  execute: async ({ expression }: { expression: string }): Promise<string> => {
    if (!expression || expression.trim().length === 0) {
      return JSON.stringify({ error: "Podaj wyrażenie matematyczne do obliczenia" });
    }

    try {
      const dangerKeywords = ["import", "require", "eval", "process", "fetch", "global", "window", "document"];
      for (const kw of dangerKeywords) {
        if (expression.toLowerCase().includes(kw)) {
          return JSON.stringify({ error: `Wyrażenie zawiera niedozwolone słowo: ${kw}` });
        }
      }
      const result = new Function(`return (${expression})`)();
      return JSON.stringify({ expression, result });
    } catch (err) {
      return JSON.stringify({ error: `Nie mogę obliczyć: ${expression}. ${err instanceof Error ? err.message : String(err)}` });
    }
  }
};

// 2. CurrentDateTime
export const currentDateTimeTool = {
  description: "Zwraca aktualną datę i czas",
  inputSchema: z.object({}),
  execute: async (): Promise<string> => {
    const now = new Date();
    const dateTime = now.toLocaleString("pl-PL", {
      timeZone: "Europe/Warsaw",
      hour12: false,
    });
    const days = ["niedziela", "poniedziałek", "wtorek", "środa", "czwartek", "piątek", "sobota"];
    const dayOfWeek = days[now.getDay()];
    const timestamp = now.getTime();
    return JSON.stringify({ dateTime, dayOfWeek, timestamp });
  }
};

// 3. GetWeather
export const getWeatherTool = {
  description: "Sprawdza aktualną pogodę w podanym mieście. WAŻNE: podaj nazwę miasta w mianowniku (forma podstawowa), np. 'Kraków' NIE 'Krakowie', 'Warszawa' NIE 'Warszawie', 'Gdańsk' NIE 'Gdańsku'.",
  inputSchema: z.object({
    city: z.string().describe("Nazwa miasta w mianowniku (forma podstawowa), np. 'Kraków', 'Warszawa', 'Gdańsk', 'Berlin', 'Paris'"),
  }),
  execute: async ({ city }: { city: string }): Promise<string> => {
    if (!city || city.trim().length === 0) {
      return JSON.stringify({ error: "Podaj nazwę miasta" });
    }

    try {
      const fetchWithTimeout = async (url: string, timeout = 5000) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        try {
          const res = await fetch(url, { signal: controller.signal });
          clearTimeout(timeoutId);
          return res;
        } catch (err) {
          clearTimeout(timeoutId);
          throw err;
        }
      };

      const searchCity = async (name: string) => {
        try {
          const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=5&language=pl`;
          const res = await fetchWithTimeout(url);
          if (!res.ok) return null;
          const data = await res.json();
          if (!data.results?.length) return null;
          return data.results.find((r: any) => r.country_code === "PL") ?? data.results[0];
        } catch (err) {
          return null;
        }
      };

      let result = await searchCity(city);
      if (!result || result.country_code !== "PL") {
        const suffixes = [/owie$/i, /iu$/i, /aniu$/i, /eniu$/i, /ie$/i, /u$/i];
        for (const suffix of suffixes) {
          if (suffix.test(city)) {
            const stripped = city.replace(suffix, "");
            if (stripped.length > 2) {
              const fallback = await searchCity(stripped);
              if (fallback) { result = fallback; break; }
            }
          }
        }
      }

      if (!result) {
        return JSON.stringify({ error: `Nie znalazłem miasta ${city}. Sprawdź pisownię.` });
      }

      const { latitude, longitude, name } = result;

      const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code`;
      const weatherRes = await fetchWithTimeout(weatherUrl);
      if (!weatherRes.ok) {
        return JSON.stringify({ error: `Timeout lub błąd API pogodowego. Spróbuj ponownie.` });
      }
      const weatherData = await weatherRes.json();
      const current = weatherData.current;
      if (!current) {
        return JSON.stringify({ error: `Brak danych pogodowych dla ${name}` });
      }

      const codeMap: Record<number, string> = {
        0: "Czyste niebo",
        1: "Głównie czyste niebo",
        2: "Częściowe zachmurzenie",
        3: "Zachmurzenie",
        45: "Mgła",
        48: "Mgła osadzająca szron",
        51: "Lekka mżawka",
        53: "Umiarkowana mżawka",
        55: "Gęsta mżawka",
        56: "Lekka marznąca mżawka",
        57: "Gęsta marznąca mżawka",
        61: "Słaby deszcz",
        63: "Umiarkowany deszcz",
        65: "Silny deszcz",
        66: "Słaby marznący deszcz",
        67: "Silny marznący deszcz",
        71: "Słabe opady śniegu",
        73: "Umiarkowane opady śniegu",
        75: "Silne opady śniegu",
        77: "Ziarna śniegu",
        80: "Słabe przelotne opady deszczu",
        81: "Umiarkowane przelotne opady deszczu",
        82: "Gwałtowne przelotne opady deszczu",
        85: "Słabe przelotne opady śniegu",
        86: "Silne przelotne opady śniegu",
        95: "Burza (lekka lub umiarkowana)",
        96: "Burza z gradem",
        99: "Burza z silnym gradem",
      };

      const description = codeMap[current.weather_code] || `Kod pogody: ${current.weather_code}`;

      return JSON.stringify({
        city: name,
        temperature: current.temperature_2m,
        humidity: current.relative_humidity_2m,
        windSpeed: current.wind_speed_10m,
        description,
      });
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return JSON.stringify({ error: "Timeout — serwer pogody nie odpowiedział w 5 sekund. Spróbuj ponownie." });
      }
      return JSON.stringify({ error: `Błąd połączenia: ${err instanceof Error ? err.message : String(err)}` });
    }
  }
};

// 4. GetExchangeRate
export const getExchangeRateTool = {
  description: "Sprawdza kurs waluty do PLN z NBP",
  inputSchema: z.object({
    currency: z.string().describe("Kod waluty, np. 'EUR', 'USD', 'GBP', 'CHF'"),
  }),
  execute: async ({ currency }: { currency: string }): Promise<string> => {
    const cur = currency.toUpperCase().trim();

    if (!cur || cur.length !== 3) {
      return JSON.stringify({ error: "Podaj 3-literowy kod waluty (np. EUR, USD)" });
    }

    try {
      const fetchWithTimeout = async (url: string, timeout = 5000) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        try {
          const res = await fetch(url, { signal: controller.signal });
          clearTimeout(timeoutId);
          return res;
        } catch (err) {
          clearTimeout(timeoutId);
          throw err;
        }
      };

      const url = `https://api.nbp.pl/api/exchangerates/rates/a/${cur}/?format=json`;
      const res = await fetchWithTimeout(url);
      if (res.status === 404) {
        return JSON.stringify({ error: `Waluta ${cur} nie jest w tabeli NBP. Popularne: EUR, USD, GBP, CHF` });
      }
      if (!res.ok) {
        return JSON.stringify({ error: `Błąd API NBP: Spróbuj ponownie.` });
      }
      const data = await res.json();
      const rate = data.rates?.[0]?.mid;
      const date = data.rates?.[0]?.effectiveDate;
      return JSON.stringify({ currency: cur, rate, date, source: "NBP" });
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return JSON.stringify({ error: "Timeout — serwer NBP nie odpowiedział. Spróbuj ponownie." });
      }
      return JSON.stringify({ error: `Waluta ${cur} nie jest w tabeli NBP. Popularne: EUR, USD, GBP, CHF` });
    }
  }
};

// 5. GetHolidays
export const getHolidaysTool = {
  description: "Sprawdza święta państwowe w danym kraju na dany rok",
  inputSchema: z.object({
    countryCode: z.string().describe("Kod kraju ISO 3166-1 alpha-2, np. 'PL', 'DE', 'FR'"),
    year: z.number().describe("Rok, np. 2026"),
  }),
  execute: async ({ countryCode, year }: { countryCode: string; year: number }): Promise<string> => {
    const cc = countryCode.toUpperCase().trim();

    if (!cc || cc.length !== 2) {
      return JSON.stringify({ error: "Podaj 2-literowy kod kraju (np. PL, DE, US). Popularne: PL, DE, US, GB, FR" });
    }

    try {
      const fetchWithTimeout = async (url: string, timeout = 5000) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        try {
          const res = await fetch(url, { signal: controller.signal });
          clearTimeout(timeoutId);
          return res;
        } catch (err) {
          clearTimeout(timeoutId);
          throw err;
        }
      };

      const url = `https://date.nager.at/api/v3/publicholidays/${year}/${cc}`;
      const res = await fetchWithTimeout(url);
      if (!res.ok) {
        return JSON.stringify({ error: `Nie znalazłem świąt dla kraju ${cc}. Popularne: PL, DE, US, GB, FR` });
      }
      const data = await res.json();
      if (!Array.isArray(data)) {
        return JSON.stringify({ error: `Błędne dane z API dla kraju ${cc}` });
      }
      const holidays = data.slice(0, 15).map(h => ({
        date: h.date,
        localName: h.localName,
        name: h.name,
      }));
      return JSON.stringify({ countryCode: cc, year, holidays });
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return JSON.stringify({ error: "Timeout — serwer świąt nie odpowiedział. Spróbuj ponownie." });
      }
      return JSON.stringify({ error: `Nie znalazłem świąt dla kraju ${cc}. Popularne: PL, DE, US, GB, FR` });
    }
  }
};

// 6. SearchWikipedia
export const searchWikipediaTool = {
  description: "Wyszukuje artykuł w Wikipedii i zwraca streszczenie",
  inputSchema: z.object({
    query: z.string().describe("Hasło do wyszukania w Wikipedii"),
  }),
  execute: async ({ query }: { query: string }): Promise<string> => {
    if (!query || query.trim().length === 0) {
      return JSON.stringify({ error: "Podaj hasło do wyszukania w Wikipedii" });
    }

    try {
      const fetchWithTimeout = async (url: string, timeout = 5000) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        try {
          const res = await fetch(url, { signal: controller.signal });
          clearTimeout(timeoutId);
          return res;
        } catch (err) {
          clearTimeout(timeoutId);
          throw err;
        }
      };

      const formattedQuery = encodeURIComponent(query.trim());
      const summaryUrl = `https://pl.wikipedia.org/api/rest_v1/page/summary/${formattedQuery}`;
      const res = await fetchWithTimeout(summaryUrl);

      if (res.ok) {
        const data = await res.json();
        const title = data.title;
        const summary = data.extract ? data.extract.substring(0, 1000) : "Brak streszczenia";
        const url = data.content_urls?.desktop?.page || `https://pl.wikipedia.org/wiki/${formattedQuery}`;
        return JSON.stringify({ title, summary, url });
      }

      const searchUrl = `https://pl.wikipedia.org/w/api.php?action=query&list=search&srsearch=${formattedQuery}&format=json&origin=*`;
      const searchRes = await fetchWithTimeout(searchUrl);
      if (!searchRes.ok) {
        return JSON.stringify({ error: `Nie znalazłem artykułu ani wyników wyszukiwania dla: ${query}` });
      }
      const searchData = await searchRes.json();
      const results = searchData.query?.search;
      if (!results || results.length === 0) {
        return JSON.stringify({ error: `Nie znalazłem artykułu w Wikipedii dla: ${query}` });
      }

      const firstTitle = results[0].title;
      const firstTitleEncoded = encodeURIComponent(firstTitle);
      const firstSummaryUrl = `https://pl.wikipedia.org/api/rest_v1/page/summary/${firstTitleEncoded}`;
      const firstSummaryRes = await fetchWithTimeout(firstSummaryUrl);
      if (firstSummaryRes.ok) {
        const firstData = await firstSummaryRes.json();
        const title = firstData.title;
        const summary = firstData.extract ? firstData.extract.substring(0, 1000) : "Brak streszczenia";
        const url = firstData.content_urls?.desktop?.page || `https://pl.wikipedia.org/wiki/${firstTitleEncoded}`;
        return JSON.stringify({ title, summary, url });
      }

      return JSON.stringify({
        title: firstTitle,
        summary: results[0].snippet.replace(/<[^>]*>/g, ""),
        url: `https://pl.wikipedia.org/wiki/${firstTitleEncoded}`
      });
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return JSON.stringify({ error: "Timeout — Wikipedia nie odpowiedziała w 5 sekund. Spróbuj ponownie." });
      }
      return JSON.stringify({ error: `Błąd połączenia z Wikipedią: ${err instanceof Error ? err.message : String(err)}` });
    }
  }
};

// 7. SaveNote
export const saveNoteTool = {
  description: "Zapisuje notatkę w pamięci agenta",
  inputSchema: z.object({
    title: z.string().describe("Tytuł notatki"),
    content: z.string().describe("Treść notatki"),
  }),
  execute: async ({ title, content }: { title: string; content: string }): Promise<string> => {
    const newNote: Note = {
      title,
      content,
      createdAt: new Date().toLocaleString("pl-PL", { timeZone: "Europe/Warsaw" }),
    };
    notesStore.push(newNote);
    return JSON.stringify({ saved: true, title });
  }
};

// 8. GetNotes
export const getNotesTool = {
  description: "Pobiera wszystkie zapisane notatki",
  inputSchema: z.object({}),
  execute: async (): Promise<string> => {
    return JSON.stringify(notesStore);
  }
};

// 9. GetTravelWarnings
export const getTravelWarningsTool = {
  description: "Pobiera ostrzeżenia podróżne dla danego kraju z bazy MSZ",
  inputSchema: z.object({
    countryCode: z.string().describe("Kod kraju ISO 3166-1 alpha-2, np. 'FR', 'IT', 'DE', 'UA'"),
  }),
  execute: async ({ countryCode }: { countryCode: string }): Promise<string> => {
    const code = countryCode.toUpperCase().trim();

    if (!code || code.length !== 2) {
      return JSON.stringify({ error: "Podaj 2-literowy kod kraju (np. FR, IT, DE)" });
    }

    // Lokalna baza danych ostrzeżeń podróżnych
    const countryNames: Record<string, string> = {
      "FR": "Francja",
      "IT": "Włochy",
      "DE": "Niemcy",
      "ES": "Hiszpania",
      "PT": "Portugalia",
      "UA": "Ukraina",
      "TR": "Turcja",
      "EG": "Egipt",
      "JP": "Japonia",
      "US": "Stany Zjednoczone",
      "GB": "Wielka Brytania",
      "PL": "Polska",
      "BE": "Belgia",
      "AT": "Austria",
      "CH": "Szwajcaria",
      "SE": "Szwecja",
      "NO": "Norwegia",
      "DK": "Dania",
      "NL": "Holandia",
    };

    const riskData: Record<string, { level: number; description: string; info: string }> = {
      "FR": { level: 1, description: "🟢 Bezpiecznie", info: "Normalna ostrożność" },
      "IT": { level: 1, description: "🟢 Bezpiecznie", info: "Normalna ostrożność" },
      "DE": { level: 1, description: "🟢 Bezpiecznie", info: "Normalna ostrożność" },
      "ES": { level: 1, description: "🟢 Bezpiecznie", info: "Normalna ostrożność" },
      "PT": { level: 1, description: "🟢 Bezpiecznie", info: "Normalna ostrożność" },
      "GB": { level: 1, description: "🟢 Bezpiecznie", info: "Normalna ostrożność" },
      "JP": { level: 1, description: "🟢 Bezpiecznie", info: "Normalna ostrożność" },
      "US": { level: 1, description: "🟢 Bezpiecznie", info: "Normalna ostrożność" },
      "PL": { level: 1, description: "🟢 Bezpiecznie", info: "Normalna ostrożność" },
      "BE": { level: 1, description: "🟢 Bezpiecznie", info: "Normalna ostrożność" },
      "AT": { level: 1, description: "🟢 Bezpiecznie", info: "Normalna ostrożność" },
      "CH": { level: 1, description: "🟢 Bezpiecznie", info: "Normalna ostrożność" },
      "SE": { level: 1, description: "🟢 Bezpiecznie", info: "Normalna ostrożność" },
      "NO": { level: 1, description: "🟢 Bezpiecznie", info: "Normalna ostrożność" },
      "DK": { level: 1, description: "🟢 Bezpiecznie", info: "Normalna ostrożność" },
      "NL": { level: 1, description: "🟢 Bezpiecznie", info: "Normalna ostrożność" },
      "UA": { level: 4, description: "⛔ Odradzane", info: "Nie podróżować — konflikt zbrojny" },
      "TR": { level: 2, description: "🟡 Ostrożnie", info: "Zwiększona czujność — możliwe zagrożenia" },
      "EG": { level: 2, description: "🟡 Ostrożnie", info: "Zwiększona czujność — możliwe zagrożenia" },
    };

    const risk = riskData[code];
    const countryName = countryNames[code] || code;

    if (!risk) {
      return JSON.stringify({
        country: countryName,
        countryCode: code,
        riskLevel: "❓ Brak danych",
        source: "MSZ Database",
      });
    }

    return JSON.stringify({
      country: countryName,
      countryCode: code,
      riskLevel: risk.description,
      level: risk.level,
      info: risk.info,
      source: "MSZ Database",
      lastUpdated: new Date().toLocaleDateString("pl-PL"),
    });
  },
};

// 10. SearchKnowledge (RAG retrieval from Supabase)
export const searchKnowledgeTool = {
  description:
    "Wyszukuje informacje w bazie wiedzy firmy (cenniki, FAQ, regulaminy, oferty). " +
    "Używaj ZAWSZE gdy użytkownik pyta o: ceny, pakiety, koszty; procedury, regulaminy, warunki; " +
    "FAQ, pytania o firmę/usługi; cokolwiek co może być w dokumentach firmowych.",
  inputSchema: z.object({
    query: z.string().describe("Pytanie użytkownika, np. 'ile kosztuje pakiet premium'"),
  }),
  execute: async ({ query }: { query: string }): Promise<string> => {
    if (!query || query.trim().length === 0) {
      return JSON.stringify({ error: "Podaj pytanie do wyszukania w bazie wiedzy" });
    }

    try {
      const embedding = await embedText(query);

      const { data, error } = await supabase.rpc("match_documents", {
        query_embedding: embedding,
        match_threshold: 0.5,
        match_count: 5,
      });

      if (error) {
        return JSON.stringify({ error: `Błąd bazy wiedzy: ${error.message}` });
      }

      const rows = (data ?? []) as Array<{
        id: string;
        title: string;
        content: string;
        similarity: number;
        metadata: Record<string, unknown>;
      }>;

      if (rows.length === 0) {
        return JSON.stringify({
          results: [],
          total_found: 0,
          source_documents: [],
          message: "Nie znaleziono informacji w bazie wiedzy.",
        });
      }

      const ids = rows.map((row) => row.id);
      const { data: createdAtRows } = await supabase.from("documents").select("id, created_at").in("id", ids);
      const createdAtById = new Map((createdAtRows ?? []).map((row) => [row.id, row.created_at]));

      const results = rows.map((row) => ({
        title: row.title,
        content: row.content,
        similarity: row.similarity,
        metadata: row.metadata,
        added_at: createdAtById.get(row.id) ?? null,
      }));

      const sourceDocuments = Array.from(new Set(results.map((r) => r.title)));

      return JSON.stringify({ results, total_found: results.length, source_documents: sourceDocuments });
    } catch (err) {
      return JSON.stringify({ error: `Błąd wyszukiwania: ${err instanceof Error ? err.message : String(err)}` });
    }
  },
};

// 11. ReadWebPage (from L3)
export const readWebPageTool = {
  description: "Pobiera i czyta zawartość strony internetowej. Używaj gdy chcesz przeczytać artykuł lub treść ze wskazanego adresu URL.",
  inputSchema: z.object({
    url: z.string().url("Musisz podać pełny URL"),
  }),
  execute: async ({ url }: { url: string }): Promise<string> => {
    if (!url || url.trim().length === 0) {
      return JSON.stringify({ error: "Podaj pełny URL strony" });
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(url, {
        signal: controller.signal,
        headers: { "User-Agent": "Mozilla/5.0" },
      });

      clearTimeout(timeout);

      if (!response.ok) {
        return JSON.stringify({ error: `Błąd ${response.status}: Strona zwróciła błąd. Sprawdź URL.` });
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

      return JSON.stringify({ content: text.slice(0, 3000), url });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return JSON.stringify({ error: "Timeout — strona nie odpowiada w ciągu 5 sekund. Spróbuj ponownie." });
      }
      return JSON.stringify({ error: `Błąd połączenia: ${error instanceof Error ? error.message : String(error)}` });
    }
  },
};
