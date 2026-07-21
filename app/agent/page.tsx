"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

const scenarioPrompts = [
  "Znajdź w Google co robi firma Syntelligence i wygeneruj dla nich logo",
  "Przeczytaj stronę apple.com i opisz ich aktualną ofertę iPhone",
  "Ile to 23% VAT z 8500 PLN? Podaj kwotę brutto i netto",
  "Jakie są najnowsze wiadomości o AI? Wygeneruj grafikę do posta o tym",
  "Wyszukaj w Google 'best coffee shops Kraków' i streszcz wyniki",
];

const tools = [
  { icon: "🧮", name: "Kalkulator" },
  { icon: "🕐", name: "Data i czas" },
  { icon: "🌐", name: "Google Search" },
  { icon: "📄", name: "Czytanie stron" },
  { icon: "🎨", name: "Generowanie obrazów" },
  { icon: "👁️", name: "Analiza obrazów" },
];

function getTextFromParts(parts: Array<{ type: string; text?: string }>) {
  return parts
    .filter((part) => part.type === "text")
    .map((part) => part.text ?? "")
    .join("");
}

export default function AgentPage() {
  const [input, setInput] = useState("");
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: { model: "flash", image: attachedImage },
      }),
    [attachedImage]
  );
  const { messages, sendMessage, status, error } = useChat({ transport });
  const isLoading = status === "submitted" || status === "streaming";

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status]);

  function handlePaste(e: React.ClipboardEvent) {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) {
          const reader = new FileReader();
          reader.onload = (readEvent) => {
            const base64 = (readEvent.target?.result as string).split(",")[1];
            setAttachedImage(base64);
          };
          reader.readAsDataURL(file);
        }
      }
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = input.trim();
    if (!text || isLoading) return;

    sendMessage({ text });
    setInput("");
  }

  function sendScenario(scenario: string) {
    if (isLoading) return;
    sendMessage({ text: scenario });
    setInput("");
  }

  return (
    <main className="chat-shell">
      <section className="chat-panel" aria-label="Pełny Agent AI">
        <header className="chat-header">
          <h1>🤖 Agent AI — Pełna moc</h1>
          <p className="agent-subtitle">{tools.length} narzędzi • autonomiczne decyzje</p>

          <div className="tools-panel">
            <div className="tools-grid">
              {tools.map((t) => (
                <div key={t.name} className="tool-badge">
                  {t.icon} {t.name}
                </div>
              ))}
            </div>
          </div>

          <div className="starter-questions">
            {scenarioPrompts.map((scenario) => (
              <button key={scenario} onClick={() => sendScenario(scenario)} type="button">
                {scenario}
              </button>
            ))}
          </div>
        </header>

        <div className="messages" aria-live="polite">
          {messages.length === 0 ? (
            <div className="empty-state">
              <p>Wybierz scenariusz lub zadaj dowolne pytanie. Agent użyje potrzebnych narzędzi.</p>
            </div>
          ) : (
            messages.map((message) => {
              const text = getTextFromParts(message.parts);
              const isUser = message.role === "user";

              return (
                <article className={`message-row ${isUser ? "user" : "assistant"}`} key={message.id}>
                  <div className="message-bubble">
                    <div className="message-meta">
                      <span className="message-author">{isUser ? "Ty" : "Agent"}</span>
                    </div>
                    {text.includes("[IMAGE]") ? (
                      <div className="inline-image">
                        {text
                          .split(/\[IMAGE\].*?\[\/IMAGE\]/)
                          .map((part, i) => (
                            <p key={i}>{part}</p>
                          ))}
                      </div>
                    ) : (
                      <p>{text}</p>
                    )}
                  </div>
                </article>
              );
            })
          )}

          {isLoading && (
            <article className="message-row assistant">
              <div className="message-bubble thinking">
                <div className="message-meta">
                  <span className="message-author">Agent</span>
                </div>
                <p>Pracuję nad tym, używając dostępnych narzędzi...</p>
              </div>
            </article>
          )}

          {error && <p className="error-message">Błąd podczas przetwarzania. Spróbuj ponownie.</p>}

          <div ref={endRef} />
        </div>

        <form className="composer" onSubmit={onSubmit} onPaste={handlePaste}>
          <input
            aria-label="Wiadomość"
            onChange={(event) => setInput(event.currentTarget.value)}
            placeholder="Napisz wiadomość... (Ctrl+V aby wkleić screenshot)"
            value={input}
            onPaste={handlePaste}
          />
          <button disabled={isLoading || input.trim().length === 0} type="submit">
            Wyślij
          </button>
        </form>
      </section>
    </main>
  );
}
