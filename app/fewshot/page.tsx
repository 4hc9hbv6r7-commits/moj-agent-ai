"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

const glossaryTerms = [
  "Sztuczna inteligencja",
  "Agent AI",
  "Prompt",
  "Halucynacja AI",
  "RAG",
  "API",
];

function getTextFromParts(parts: Array<{ type: string; text?: string }>) {
  return parts
    .filter((part) => part.type === "text")
    .map((part) => part.text ?? "")
    .join("");
}

export default function FewShotPage() {
  const [input, setInput] = useState("");
  const endRef = useRef<HTMLDivElement | null>(null);
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/fewshot",
      }),
    [],
  );
  const { messages, sendMessage, status, error } = useChat({ transport });
  const isLoading = status === "submitted" || status === "streaming";

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status]);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const text = input.trim();
    if (!text || isLoading) {
      return;
    }

    sendMessage({ text });
    setInput("");
  }

  function fillTerm(term: string) {
    setInput(`Czym jest ${term}?`);
  }

  return (
    <main className="chat-shell">
      <section className="chat-panel" aria-label="Slownik AI">
        <header className="chat-header">
          <h1>📚 Słownik AI</h1>
          <p className="agent-subtitle">Wyjaśniam trudne pojęcia prostym językiem.</p>
          <div className="starter-questions" aria-label="Pojecia slownika">
            {glossaryTerms.map((term) => (
              <button key={term} onClick={() => fillTerm(term)} type="button">
                {term}
              </button>
            ))}
          </div>
        </header>

        <div className="messages" aria-live="polite">
          {messages.length === 0 ? (
            <div className="empty-state">
              <p>Wpisz pojęcie do wyjaśnienia i sprawdź format few-shot.</p>
            </div>
          ) : (
            messages.map((message) => {
              const text = getTextFromParts(message.parts);
              const isUser = message.role === "user";

              return (
                <article className={`message-row ${isUser ? "user" : "assistant"}`} key={message.id}>
                  <div className="message-bubble">
                    <div className="message-meta">
                      <span className="message-author">{isUser ? "Ty" : "Słownik AI"}</span>
                    </div>
                    <p>{text}</p>
                  </div>
                </article>
              );
            })
          )}

          {isLoading && (
            <article className="message-row assistant">
              <div className="message-bubble thinking">
                <div className="message-meta">
                  <span className="message-author">Słownik AI</span>
                </div>
                <p>Wyjaśniam pojęcie...</p>
              </div>
            </article>
          )}

          {error && (
            <p className="error-message">
              Nie udało się wygenerować odpowiedzi. Sprawdź klucz API i spróbuj ponownie.
            </p>
          )}

          <div ref={endRef} />
        </div>

        <form className="composer" onSubmit={onSubmit}>
          <input
            aria-label="Pojecie do wyjasnienia"
            onChange={(event) => setInput(event.currentTarget.value)}
            placeholder="Wpisz pojęcie do wyjaśnienia..."
            value={input}
          />
          <button disabled={isLoading || input.trim().length === 0} type="submit">
            Wyjaśnij
          </button>
        </form>
      </section>
    </main>
  );
}
