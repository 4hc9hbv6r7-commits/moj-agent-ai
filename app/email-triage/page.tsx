"use client";

import { useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const exampleEmails = [
  `Mail 1 - PILNY:
Od: jan.kowalski@firma.pl
Temat: PILNE - Problem z fakturą
Treść: Dzień dobry, mam problem z fakturą FV/2026/001. Kwota jest nieprawidłowa — powinno być 5000 zł a jest 3000 zł. Proszę o PILNĄ korektę. Termin płatności mija jutro.`,
  `Mail 2 - SPAM:
Od: winner@lucky-prize.com
Temat: Congratulations! You won $1,000,000
Treść: Click here to claim your prize! Limited time offer. Act now!`,
  `Mail 3 - OFERTA:
Od: anna.nowak@partner.pl
Temat: Propozycja współpracy
Treść: Dzień dobry, reprezentuję firmę ABC Solutions. Chcielibyśmy omówić możliwość współpracy w zakresie dostarczania usług IT. Czy możemy umówić się na spotkanie w przyszłym tygodniu?`,
  `Mail 4 - REKLAMACJA:
Od: klient123@gmail.com
Temat: Nie działa usługa od 3 dni
Treść: Witam, od poniedziałku nie mogę się zalogować do panelu klienta. Próbowałem resetować hasło ale nie dostaje maila. To już trzeci dzień! Jeśli nie rozwiążecie tego dziś, zrezygnuję z usługi.`,
  `Mail 5 - INFO:
Od: newsletter@branżowy-portal.pl
Temat: Nowe trendy AI w biznesie - raport 2026
Treść: Zapraszamy do lektury naszego najnowszego raportu o zastosowaniach AI w polskich firmach. Pobierz za darmo na naszej stronie.`,
].join("\n\n");

type Section = {
  key: string;
  text: string;
  isMail: boolean;
  priority: "high" | "medium" | "low" | null;
  draft: string | null;
};

function parseSections(text: string): Section[] {
  return text
    .split(/\n-{3,}\n/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk, index) => {
      const isMail = /^###\s*Mail/i.test(chunk);
      const priorityMatch = chunk.match(/🔴|🟡|🟢/);
      const priority =
        priorityMatch?.[0] === "🔴" ? "high" : priorityMatch?.[0] === "🟡" ? "medium" : priorityMatch?.[0] === "🟢" ? "low" : null;
      const draftMatch = chunk.match(/\*\*Proponowana odpowiedź:\*\*\s*\n((?:>.*\n?)+)/);
      const draft = draftMatch ? draftMatch[1].replace(/^>\s?/gm, "").trim() : null;

      return { key: `section-${index}`, text: chunk, isMail, priority, draft };
    });
}

export default function EmailTriagePage() {
  const [input, setInput] = useState("");
  const [resultText, setResultText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const sections = useMemo(() => parseSections(resultText), [resultText]);

  function fillExample() {
    setInput(exampleEmails);
  }

  async function analyzeEmails() {
    const emails = input
      .split(/\n\s*\n/)
      .map((chunk) => chunk.trim())
      .filter(Boolean);

    if (emails.length === 0 || isLoading) {
      return;
    }

    setIsLoading(true);
    setError(null);
    setResultText("");

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch("/api/email-triage", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ emails }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        throw new Error(`Request failed: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setResultText(accumulated);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }

  async function copyDraft(key: string, draft: string) {
    await navigator.clipboard.writeText(draft);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey((current) => (current === key ? null : current)), 2000);
  }

  return (
    <main className="chat-shell">
      <section className="chat-panel" aria-label="E-mail triage">
        <header className="chat-header">
          <h1>📧 E-mail Triage</h1>
          <p className="agent-subtitle">Wklej maile — agent posortuje i napisze odpowiedzi.</p>
          <div className="starter-questions">
            <button onClick={fillExample} type="button">
              📋 Wklej przykład
            </button>
          </div>
        </header>

        <div className="messages" aria-live="polite">
          {sections.length === 0 ? (
            <div className="empty-state">
              <p>Wklej maile i kliknij &bdquo;Analizuj maile&rdquo;, aby zobaczyć kategorie, priorytety i szkice odpowiedzi.</p>
            </div>
          ) : (
            sections.map((section) => (
              <article
                key={section.key}
                className={section.isMail ? `email-card priority-${section.priority ?? "none"}` : "email-summary"}
              >
                <div className="markdown-render">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{section.text}</ReactMarkdown>
                </div>

                {section.draft && (
                  <button className="copy-draft-button" onClick={() => copyDraft(section.key, section.draft!)} type="button">
                    {copiedKey === section.key ? "✅ Skopiowano" : "📋 Kopiuj draft"}
                  </button>
                )}
              </article>
            ))
          )}

          {isLoading && sections.length === 0 && (
            <div className="empty-state">
              <p>Analizuję maile...</p>
            </div>
          )}

          {error && <p className="error-message">Nie udało się przeanalizować maili. Spróbuj ponownie.</p>}
        </div>

        <form
          className="composer email-composer"
          onSubmit={(event) => {
            event.preventDefault();
            analyzeEmails();
          }}
        >
          <textarea
            aria-label="Maile do analizy"
            className="upload-textarea"
            onChange={(event) => setInput(event.currentTarget.value)}
            placeholder="Wklej maile tutaj — oddziel je pustą linią..."
            value={input}
          />
          <button disabled={isLoading || input.trim().length === 0} type="submit">
            {isLoading ? "Analizuję..." : "📧 Analizuj maile"}
          </button>
        </form>
      </section>
    </main>
  );
}
