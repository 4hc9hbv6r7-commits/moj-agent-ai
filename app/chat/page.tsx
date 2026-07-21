"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/AuthProvider";

type ChatModel = "flash" | "pro";

const models: Array<{ id: ChatModel; label: string; badge: string }> = [
  { id: "flash", label: "⚡ Flash", badge: "⚡ flash" },
  { id: "pro", label: "🧠 Pro", badge: "🧠 pro" },
];

const starterQuestions = [
  "Jak rozpoznac phishing BEC w firmie?",
  "Jak zbudowac podstawowy proces triage alertow SOC?",
  "Jakie IOC warto monitorowac po incydencie ransomware?",
  "Jak przygotowac szybki playbook reakcji na wyciek danych?",
];

function getTextFromParts(parts: Array<{ type: string; text?: string }>) {
  return parts
    .filter((part) => part.type === "text")
    .map((part) => part.text ?? "")
    .join("");
}

function truncateTitle(text: string) {
  return text.length > 50 ? `${text.slice(0, 50)}...` : text;
}

export default function ChatPage() {
  const { user, session } = useAuth();
  const [input, setInput] = useState("");
  const [model, setModel] = useState<ChatModel>("flash");
  const [responseModel, setResponseModel] = useState<ChatModel | null>(null);
  const [messageModels, setMessageModels] = useState<Record<string, ChatModel>>({});
  const [copied, setCopied] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const conversationIdRef = useRef<string | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);
  const accessToken = session?.access_token;
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        body: { model },
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      }),
    [model, accessToken],
  );

  async function persistUserMessage(text: string) {
    if (!user) return;

    if (!conversationIdRef.current) {
      const { data } = await supabase
        .from("conversations")
        .insert({ title: truncateTitle(text), user_id: user.id })
        .select("id")
        .single();

      if (data) {
        conversationIdRef.current = data.id;
      }
    }

    if (!conversationIdRef.current) {
      return;
    }

    await supabase.from("messages").insert({
      conversation_id: conversationIdRef.current,
      role: "user",
      content: text,
    });

    await supabase
      .from("conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", conversationIdRef.current);
  }

  async function persistAssistantMessage(text: string) {
    if (!conversationIdRef.current || !text) {
      return;
    }

    await supabase.from("messages").insert({
      conversation_id: conversationIdRef.current,
      role: "assistant",
      content: text,
    });

    await supabase
      .from("conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", conversationIdRef.current);
  }

  const { messages, sendMessage, setMessages, status, error } = useChat({
    transport,
    onFinish: ({ message }) => {
      persistAssistantMessage(getTextFromParts(message.parts));
    },
  });

  useEffect(() => {
    if (!user) return;

    async function ensureUserProfile() {
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("id")
        .eq("id", user!.id)
        .maybeSingle();

      if (!profile) {
        await supabase.from("user_profiles").insert({ id: user!.id, name: null });
      }
    }

    async function loadConversation() {
      const requestedId = new URLSearchParams(window.location.search).get("conversationId");

      const { data: conversation } = requestedId
        ? await supabase
            .from("conversations")
            .select("id")
            .eq("id", requestedId)
            .eq("user_id", user!.id)
            .maybeSingle()
        : await supabase
            .from("conversations")
            .select("id")
            .eq("user_id", user!.id)
            .order("updated_at", { ascending: false })
            .limit(1)
            .maybeSingle();

      if (conversation) {
        conversationIdRef.current = conversation.id;

        const { data: history } = await supabase
          .from("messages")
          .select("id, role, content")
          .eq("conversation_id", conversation.id)
          .order("created_at", { ascending: true });

        if (history && history.length > 0) {
          setMessages(
            history.map((row) => ({
              id: row.id,
              role: row.role as "user" | "assistant",
              parts: [{ type: "text", text: row.content }],
            })) as UIMessage[],
          );
        }
      }

      setHistoryLoaded(true);
    }

    ensureUserProfile();
    loadConversation();
  }, [user, setMessages]);

  const isLoading = status === "submitted" || status === "streaming";
  const conversationText = messages
    .map((message) => {
      const label = message.role === "user" ? "User" : "Agent";
      return `${label}: ${getTextFromParts(message.parts)}`;
    })
    .join("\n");
  const characterCount = conversationText.length;
  const estimatedTokens = Math.ceil(characterCount / 4);

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
    persistUserMessage(text);
    sendMessage({ text });
    setInput("");
  }

  function sendStarterQuestion(question: string) {
    if (isLoading) {
      return;
    }

    setResponseModel(model);
    persistUserMessage(question);
    sendMessage({ text: question });
  }

  function startNewConversation() {
    setMessages([]);
    setMessageModels({});
    setResponseModel(null);
    setCopied(false);
    conversationIdRef.current = null;
  }

  async function exportConversation() {
    if (!conversationText) {
      return;
    }

    await navigator.clipboard.writeText(conversationText);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <main className="chat-shell">
      <section className="chat-panel" aria-label="Czat z agentem AI">
        <header className="chat-header">
          <h1>Aneta Sentinel - Threat Intel Expert 🛡️</h1>
          <p className="agent-subtitle">
            Ekspert od threat intelligence i operacji SOC. Zapytaj mnie o phishing, IOC, TTP i reakcje na incydenty.
          </p>
          <div className="starter-questions" aria-label="Przykladowe pytania">
            {starterQuestions.map((question) => (
              <button
                disabled={!historyLoaded}
                key={question}
                onClick={() => sendStarterQuestion(question)}
                type="button"
              >
                {question}
              </button>
            ))}
          </div>
        </header>

        <details className="memory-panel" open>
          <summary>
            <span>Kontekst rozmowy</span>
            <span className="memory-counter">
              Wiadomości: {messages.length} | ~Tokeny: {estimatedTokens}
            </span>
          </summary>
          <div className="memory-content">
            <p>
              Agent korzysta z pełnej historii rozmowy, więc pamięta wcześniejsze ustalenia i
              potrafi je podsumować.
            </p>
            <div className="memory-actions">
              <button disabled={isLoading || messages.length === 0} onClick={startNewConversation} type="button">
                🗑 Nowa rozmowa
              </button>
              <button disabled={messages.length === 0} onClick={exportConversation} type="button">
                📋 Eksportuj rozmowę
              </button>
              {copied && <span className="copy-confirmation">Skopiowano!</span>}
            </div>
          </div>
        </details>

        <div className="messages" aria-live="polite">
          {!historyLoaded ? (
            <div className="empty-state">
              <p>⏳ Wczytuję poprzednią rozmowę...</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="empty-state">
              <p>Zacznij rozmowę i zadaj pierwsze pytanie.</p>
            </div>
          ) : (
            messages.map((message) => {
              const text = getTextFromParts(message.parts);
              const isUser = message.role === "user";
              const messageModel = messageModels[message.id] ?? model;
              const modelMeta = models.find((item) => item.id === messageModel);

              return (
                <article
                  className={`message-row ${isUser ? "user" : "assistant"}`}
                  key={message.id}
                >
                  <div className="message-bubble">
                    <div className="message-meta">
                      <span className="message-author">{isUser ? "Ty" : "Aneta"}</span>
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
                  <span className="message-author">Aneta</span>
                  <span className={`model-badge ${responseModel ?? model}`}>
                    {models.find((item) => item.id === (responseModel ?? model))?.badge}
                  </span>
                </div>
                <p>Myślę...</p>
              </div>
            </article>
          )}

          {error && (
            <p className="error-message">
              Wystąpił błąd. Sprawdź klucz API i spróbuj ponownie.
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
            placeholder="Napisz wiadomość..."
            value={input}
          />
          <button disabled={isLoading || !historyLoaded || input.trim().length === 0} type="submit">
            Wyślij
          </button>
        </form>
      </section>
    </main>
  );
}
