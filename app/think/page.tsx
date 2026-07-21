"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

type ChatModel = "flash";

const models: Array<{ id: ChatModel; label: string; badge: string }> = [
  { id: "flash", label: "⚡ Flash", badge: "⚡ flash" },
];

function getTextFromParts(parts: Array<{ type: string; text?: string }>) {
  return parts
    .filter((part) => part.type === "text")
    .map((part) => part.text ?? "")
    .join("");
}

export default function ThinkPage() {
  const [input, setInput] = useState("");
  const [model, setModel] = useState<ChatModel>("flash");
  const [responseModel, setResponseModel] = useState<ChatModel | null>(null);
  const [messageModels, setMessageModels] = useState<Record<string, ChatModel>>({});
  const endRef = useRef<HTMLDivElement | null>(null);
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/think",
        body: { model },
      }),
    [model],
  );
  const { messages, sendMessage, status, error } = useChat({ transport });

  const isLoading = status === "submitted" || status === "streaming";

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status]);

  useEffect(() => {
    const missingAssistantMessages = messages.filter(
      (message) => message.role === "assistant" && !messageModels[message.id],
    );

    if (missingAssistantMessages.length === 0) {
      return;
    }

    const modelForNewMessages = responseModel ?? model;
    setMessageModels((current) => {
      const next = { ...current };
      for (const message of missingAssistantMessages) {
        next[message.id] = modelForNewMessages;
      }
      return next;
    });
  }, [messages, messageModels, model, responseModel]);

  useEffect(() => {
    if (status === "ready" || status === "error") {
      setResponseModel(null);
    }
  }, [status]);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const text = input.trim();
    if (!text || isLoading) {
      return;
    }

    setResponseModel(model);
    sendMessage({ text });
    setInput("");
  }

  return (
    <main className="chat-shell">
      <section className="chat-panel" aria-label="Tryb głębokiego myślenia">
        <header className="chat-header">
          <h1>🧠 Tryb głębokiego myślenia</h1>
          <p className="agent-subtitle">Agent pokazuje tok rozumowania krok po kroku.</p>
        </header>

        <div className="messages" aria-live="polite">
          {messages.length === 0 ? (
            <div className="empty-state">
              <p>Zadaj trudne pytanie, a agent rozłoży je na kroki analityczne.</p>
            </div>
          ) : (
            messages.map((message) => {
              const text = getTextFromParts(message.parts);
              const isUser = message.role === "user";
              const messageModel = messageModels[message.id] ?? model;
              const modelMeta = models.find((item) => item.id === messageModel);

              return (
                <article className={`message-row ${isUser ? "user" : "assistant"}`} key={message.id}>
                  <div className="message-bubble">
                    <div className="message-meta">
                      <span className="message-author">{isUser ? "Ty" : "Think Agent"}</span>
                      {!isUser && modelMeta && (
                        <span className={`model-badge ${messageModel}`}>{modelMeta.badge}</span>
                      )}
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
                  <span className="message-author">Think Agent</span>
                  <span className={`model-badge ${responseModel ?? model}`}>
                    {models.find((item) => item.id === (responseModel ?? model))?.badge}
                  </span>
                </div>
                <p>Analizuję krok po kroku...</p>
              </div>
            </article>
          )}

          {error && (
            <p className="error-message">
              Nie udało się wygenerować analizy. Sprawdź klucz API i spróbuj ponownie.
            </p>
          )}

          <div ref={endRef} />
        </div>

        <div className="model-switcher" aria-label="Model AI">
          {models.map((item) => (
            <button
              aria-pressed={model === item.id}
              className={model === item.id ? "active" : ""}
              disabled={isLoading}
              key={item.id}
              onClick={() => setModel(item.id)}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </div>

        <form className="composer" onSubmit={onSubmit}>
          <input
            aria-label="Wiadomość"
            onChange={(event) => setInput(event.currentTarget.value)}
            placeholder="Zadaj trudne pytanie..."
            value={input}
          />
          <button disabled={isLoading || input.trim().length === 0} type="submit">
            Analizuj
          </button>
        </form>
      </section>
    </main>
  );
}
