"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

const starterQuestions = [
  "Jakie są najnowsze wiadomości o sztucznej inteligencji?",
  "Ile kosztuje iPhone 16 Pro w Polsce?",
  "Kto wygrał ostatni mecz reprezentacji Polski?",
  "Jakie filmy są teraz w kinach?",
];

function getTextFromParts(parts: Array<{ type: string; text?: string }>) {
  return parts
    .filter((part) => part.type === "text")
    .map((part) => part.text ?? "")
    .join("");
}

export default function SearchPage() {
  const [input, setInput] = useState("");
  const endRef = useRef<HTMLDivElement | null>(null);
  const transport = useMemo(
    () => new DefaultChatTransport({ api: "/api/chat", body: { model: "flash" } }),
    []
  );
  const { messages, sendMessage, status, error } = useChat({ transport });
  const isLoading = status === "submitted" || status === "streaming";

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status]);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = input.trim();
    if (!text || isLoading) return;
    sendMessage({ text });
    setInput("");
  }

  function sendStarterQuestion(question: string) {
    sendMessage({ text: question });
  }

  return (
    <main className="chat-shell">
      <section className="chat-panel" aria-label="Wyszukiwanie z internetem">
        <header className="chat-header">
          <h1>🌐 Agent z wyszukiwarką</h1>
          <p className="agent-subtitle">Przeszukuję prawdziwy internet i czytam strony.</p>
          <div className="starter-questions">
            {starterQuestions.map((q) => (
              <button key={q} onClick={() => sendStarterQuestion(q)} type="button">
                {q}
              </button>
            ))}
          </div>
        </header>

        <div className="messages" aria-live="polite">
          {messages.length === 0 ? (
            <div className="empty-state">
              <p>Zadaj pytanie o cokolwiek aktualnego. Agent przeszuka Google i przeczyta strony.</p>
            </div>
          ) : (
            messages.map((message) => {
              const text = getTextFromParts(message.parts);
              const isUser = message.role === "user";

              return (
                <article className={`message-row ${isUser ? "user" : "assistant"}`} key={message.id}>
                  <div className="message-bubble">
                    <div className="message-meta">
                      <span className="message-author">{isUser ? "Ty" : "Aneta"}</span>
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
                  <span className="message-author">Aneta</span>
                </div>
                <p>Szukam w Google i czytam strony...</p>
              </div>
            </article>
          )}

          {error && (
            <p className="error-message">Nie udało się uzyskać odpowiedzi. Sprawdź klucz API.</p>
          )}

          <div ref={endRef} />
        </div>

        <form className="composer" onSubmit={onSubmit}>
          <input
            aria-label="Pytanie"
            onChange={(event) => setInput(event.currentTarget.value)}
            placeholder="Zapytaj o cokolwiek aktualnego..."
            value={input}
          />
          <button disabled={isLoading || input.trim().length === 0} type="submit">
            Wyślij
          </button>
        </form>
      </section>
    </main>
  );
}
