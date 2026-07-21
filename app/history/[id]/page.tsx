"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { useAuth } from "../../../lib/AuthProvider";
import { supabase } from "../../../lib/supabase";

interface ConversationMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

interface ConversationDetail {
  id: string;
  title: string;
  updated_at: string;
}

export default function HistoryConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useAuth();
  const [conversation, setConversation] = useState<ConversationDetail | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[] | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!user) return;

    async function load() {
      const { data: convo } = await supabase
        .from("conversations")
        .select("id, title, updated_at")
        .eq("id", id)
        .eq("user_id", user!.id)
        .maybeSingle();

      if (!convo) {
        setNotFound(true);
        return;
      }

      setConversation(convo);

      const { data: history } = await supabase
        .from("messages")
        .select("id, role, content, created_at")
        .eq("conversation_id", id)
        .order("created_at", { ascending: true });

      setMessages(history ?? []);
    }

    load();
  }, [id, user]);

  if (notFound) {
    return (
      <main className="history-shell">
        <section className="history-panel">
          <div className="empty-state">
            <p>Nie znaleziono tej rozmowy.</p>
            <Link href="/history" className="history-cta">← Wróć do listy</Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="history-shell">
      <section className="history-panel">
        <header className="history-header">
          <div className="history-detail-nav">
            <Link href="/history" className="history-back-link">← Wróć do listy</Link>
            <Link href={`/chat?conversationId=${id}`} className="history-continue-link">
              🔄 Kontynuuj rozmowę
            </Link>
          </div>
          <h1>{conversation?.title || "Rozmowa"}</h1>
          {conversation && <p className="agent-subtitle">{new Date(conversation.updated_at).toLocaleString("pl-PL")}</p>}
        </header>

        <div className="messages history-readonly-messages">
          {messages === null ? (
            <div className="empty-state">
              <p>⏳ Wczytuję rozmowę...</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="empty-state">
              <p>Ta rozmowa nie ma jeszcze wiadomości.</p>
            </div>
          ) : (
            messages.map((message) => (
              <article
                className={`message-row ${message.role === "user" ? "user" : "assistant"}`}
                key={message.id}
              >
                <div className="message-bubble">
                  <div className="message-meta">
                    <span className="message-author">{message.role === "user" ? "Ty" : "Aneta"}</span>
                    <span className="history-message-time">
                      {new Date(message.created_at).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <p>{message.content}</p>
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
