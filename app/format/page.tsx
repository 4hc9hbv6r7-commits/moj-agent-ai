"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const formatCommands = [
  "/tabela jezyki programowania 2026",
  "/porownanie ChatGPT vs Claude",
  "/lista 5 krokow do pierwszego agenta AI",
  "/faq sztuczna inteligencja dla poczatkujacych",
  "/email podziekowanie za udana rekrutacje",
];

function getTextFromParts(parts: Array<{ type: string; text?: string }>) {
  return parts
    .filter((part) => part.type === "text")
    .map((part) => part.text ?? "")
    .join("");
}

export default function FormatPage() {
  const [input, setInput] = useState("");
  const endRef = useRef<HTMLDivElement | null>(null);
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/format",
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

  function fillCommand(command: string) {
    setInput(command);
  }

  return (
    <main className="chat-shell">
      <section className="chat-panel" aria-label="Formatowanie odpowiedzi">
        <header className="chat-header">
          <h1>📐 Formatowanie</h1>
          <p className="agent-subtitle">
            Agent odpowiada w tabeli, liscie, porownaniu - na zadanie.
          </p>
          <div className="starter-questions" aria-label="Komendy formatujace">
            {formatCommands.map((command) => (
              <button key={command} onClick={() => fillCommand(command)} type="button">
                {command}
              </button>
            ))}
          </div>
        </header>

        <div className="messages" aria-live="polite">
          {messages.length === 0 ? (
            <div className="empty-state">
              <p>Wybierz komende formatowania lub wpisz swoja.</p>
            </div>
          ) : (
            messages.map((message) => {
              const text = getTextFromParts(message.parts);
              const isUser = message.role === "user";

              return (
                <article className={`message-row ${isUser ? "user" : "assistant"}`} key={message.id}>
                  <div className="message-bubble">
                    <div className="message-meta">
                      <span className="message-author">{isUser ? "Ty" : "Formater"}</span>
                    </div>
                    {isUser ? (
                      <p>{text}</p>
                    ) : (
                      <div className="markdown-render">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
                      </div>
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
                  <span className="message-author">Formater</span>
                </div>
                <p>Formatuje odpowiedz...</p>
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
            aria-label="Komenda formatu"
            onChange={(event) => setInput(event.currentTarget.value)}
            placeholder="Wpisz komende lub pytanie..."
            value={input}
          />
          <button disabled={isLoading || input.trim().length === 0} type="submit">
            Wyslij
          </button>
        </form>
      </section>
    </main>
  );
}
