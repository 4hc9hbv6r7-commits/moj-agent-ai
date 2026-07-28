"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const exampleSets: Array<[string, string, string]> = [
  ["Shopify", "WooCommerce", "PrestaShop"],
  ["Notion", "Obsidian", "Evernote"],
  ["Vercel", "Netlify", "Railway"],
  ["ChatGPT", "Claude", "Gemini"],
];

export default function CompetitorPage() {
  const [companyA, setCompanyA] = useState("");
  const [companyB, setCompanyB] = useState("");
  const [companyC, setCompanyC] = useState("");
  const [context, setContext] = useState("");
  const [resultText, setResultText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function fillExample(set: [string, string, string]) {
    setCompanyA(set[0]);
    setCompanyB(set[1]);
    setCompanyC(set[2]);
  }

  async function compareCompanies() {
    const companies = [companyA, companyB, companyC].map((c) => c.trim()).filter(Boolean);

    if (companies.length < 2 || isLoading) {
      return;
    }

    setIsLoading(true);
    setError(null);
    setResultText("");
    setCopied(false);

    try {
      const response = await fetch("/api/competitor", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ companies, context: context.trim() }),
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

  async function copyAnalysis() {
    await navigator.clipboard.writeText(resultText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <main className="chat-shell">
      <section className="chat-panel" aria-label="Analiza konkurencji">
        <header className="chat-header">
          <h1>🏢 Analiza konkurencji</h1>
          <p className="agent-subtitle">Podaj firmy — agent porówna je za Ciebie.</p>
          <div className="starter-questions">
            {exampleSets.map((set) => (
              <button disabled={isLoading} key={set.join("-")} onClick={() => fillExample(set)} type="button">
                {set.join(" vs ")}
              </button>
            ))}
          </div>
        </header>

        <div className="messages" aria-live="polite">
          {!resultText && !isLoading ? (
            <div className="empty-state">
              <p>Podaj 2-3 firmy, a agent poszuka informacji, porówna je w tabeli i da rekomendację.</p>
            </div>
          ) : (
            <>
              {isLoading && !resultText && (
                <div className="empty-state">
                  <p>Szukam informacji i porównuję...</p>
                </div>
              )}

              {resultText && (
                <div className="markdown-render">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{resultText}</ReactMarkdown>
                </div>
              )}
            </>
          )}

          {error && <p className="error-message">Nie udało się przeprowadzić analizy. Spróbuj ponownie.</p>}

          {resultText && !isLoading && (
            <button className="copy-draft-button" onClick={copyAnalysis} type="button">
              {copied ? "✅ Skopiowano" : "📋 Kopiuj analizę"}
            </button>
          )}
        </div>

        <form
          className="composer competitor-composer"
          onSubmit={(event) => {
            event.preventDefault();
            compareCompanies();
          }}
        >
          <div className="competitor-inputs">
            <input
              aria-label="Firma 1"
              onChange={(event) => setCompanyA(event.currentTarget.value)}
              placeholder="Np. Shopify"
              value={companyA}
            />
            <input
              aria-label="Firma 2"
              onChange={(event) => setCompanyB(event.currentTarget.value)}
              placeholder="Np. WooCommerce"
              value={companyB}
            />
            <input
              aria-label="Firma 3"
              onChange={(event) => setCompanyC(event.currentTarget.value)}
              placeholder="Np. PrestaShop"
              value={companyC}
            />
          </div>
          <textarea
            aria-label="Kontekst (opcjonalnie)"
            className="upload-textarea competitor-context"
            onChange={(event) => setContext(event.currentTarget.value)}
            placeholder="Kontekst (opcjonalnie) — np. Szukam platformy e-commerce dla małego sklepu"
            value={context}
          />
          <button disabled={isLoading || [companyA, companyB, companyC].filter((c) => c.trim()).length < 2} type="submit">
            {isLoading ? "Porównuję..." : "🔍 Porównaj"}
          </button>
        </form>
      </section>
    </main>
  );
}
