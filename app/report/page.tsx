"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useAuth } from "../../lib/AuthProvider";

const exampleTopics = [
  "Rynek AI w Polsce — trendy, firmy, prognozy na 2026",
  "Porównanie platform e-commerce: Shopify vs WooCommerce vs PrestaShop",
  "Wpływ pracy zdalnej na produktywność — badania i statystyki",
  "Rynek nieruchomości w Krakowie — ceny, trendy, prognozy",
];

export default function ReportPage() {
  const { session } = useAuth();
  const [topic, setTopic] = useState("");
  const [reportText, setReportText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  async function generateReport() {
    const trimmed = topic.trim();
    if (!trimmed || isLoading) {
      return;
    }

    setIsLoading(true);
    setError(null);
    setReportText("");
    setCopied(false);
    setSaveMessage(null);

    try {
      const response = await fetch("/api/report", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ topic: trimmed }),
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
        setReportText(accumulated);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }

  async function copyReport() {
    await navigator.clipboard.writeText(reportText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function saveReport() {
    if (!reportText || isSaving) {
      return;
    }

    setIsSaving(true);
    setSaveMessage(null);

    try {
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ topic, content: reportText }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? "Nie udało się zapisać raportu");
      }

      setSaveMessage("✅ Zapisano w bazie");
    } catch (err) {
      setSaveMessage(`❌ ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main className="chat-shell">
      <section className="chat-panel" aria-label="Generator raportów">
        <header className="chat-header">
          <h1>📊 Generator raportów</h1>
          <p className="agent-subtitle">Opisz temat — agent napisze raport biznesowy.</p>
          <div className="starter-questions">
            {exampleTopics.map((example) => (
              <button disabled={isLoading} key={example} onClick={() => setTopic(example)} type="button">
                {example}
              </button>
            ))}
          </div>
        </header>

        <div className="messages" aria-live="polite">
          {!reportText && !isLoading ? (
            <div className="empty-state">
              <p>Podaj temat, a agent poszuka danych i napisze raport z sekcjami i wnioskami.</p>
            </div>
          ) : (
            <>
              {isLoading && !reportText && (
                <div className="empty-state">
                  <p>Szukam danych i piszę raport...</p>
                </div>
              )}

              {reportText && (
                <div className="markdown-render">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{reportText}</ReactMarkdown>
                </div>
              )}
            </>
          )}

          {error && <p className="error-message">Nie udało się wygenerować raportu. Spróbuj ponownie.</p>}

          {reportText && !isLoading && (
            <div className="report-actions">
              <button className="copy-draft-button" onClick={copyReport} type="button">
                {copied ? "✅ Skopiowano" : "📋 Kopiuj do schowka"}
              </button>
              <button className="copy-draft-button" disabled={isSaving} onClick={saveReport} type="button">
                {isSaving ? "Zapisuję..." : "💾 Zapisz w bazie"}
              </button>
              {saveMessage && <span className="save-message">{saveMessage}</span>}
            </div>
          )}
        </div>

        <form
          className="composer"
          onSubmit={(event) => {
            event.preventDefault();
            generateReport();
          }}
        >
          <input
            aria-label="Temat raportu"
            onChange={(event) => setTopic(event.currentTarget.value)}
            placeholder="Np. Rynek AI w Polsce w 2026 roku..."
            value={topic}
          />
          <button disabled={isLoading || topic.trim().length === 0} type="submit">
            {isLoading ? "Generuję..." : "📊 Generuj raport"}
          </button>
        </form>
      </section>
    </main>
  );
}
