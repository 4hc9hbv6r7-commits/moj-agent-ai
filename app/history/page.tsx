"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

interface ConversationSummary {
  id: string;
  title: string;
  updated_at: string;
  messageCount: number;
  lastMessagePreview: string;
}

function pluralPL(n: number, forms: [string, string, string]) {
  if (n === 1) return forms[0];
  const lastDigit = n % 10;
  const lastTwo = n % 100;
  if (lastDigit >= 2 && lastDigit <= 4 && !(lastTwo >= 12 && lastTwo <= 14)) return forms[1];
  return forms[2];
}

function formatRelativeDate(iso: string): string {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMin < 1) return "przed chwilą";
  if (diffMin < 60) return `${diffMin} ${pluralPL(diffMin, ["minutę", "minuty", "minut"])} temu`;
  if (diffHours < 24) return `${diffHours} ${pluralPL(diffHours, ["godzinę", "godziny", "godzin"])} temu`;
  if (diffDays === 1) return "wczoraj";
  if (diffDays < 7) return `${diffDays} ${pluralPL(diffDays, ["dzień", "dni", "dni"])} temu`;

  return date.toLocaleDateString("pl-PL", { day: "numeric", month: "long", year: "numeric" });
}

function truncate(text: string, max: number) {
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

export default function HistoryPage() {
  const [conversations, setConversations] = useState<ConversationSummary[] | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  async function loadConversations() {
    const { data: convos } = await supabase
      .from("conversations")
      .select("id, title, updated_at")
      .order("updated_at", { ascending: false });

    if (!convos || convos.length === 0) {
      setConversations([]);
      return;
    }

    const ids = convos.map((c) => c.id);
    const { data: allMessages } = await supabase
      .from("messages")
      .select("id, conversation_id, content, created_at")
      .in("conversation_id", ids)
      .order("created_at", { ascending: true });

    const byConversation = new Map<string, { count: number; lastContent: string }>();
    for (const msg of allMessages ?? []) {
      const entry = byConversation.get(msg.conversation_id) ?? { count: 0, lastContent: "" };
      entry.count += 1;
      entry.lastContent = msg.content;
      byConversation.set(msg.conversation_id, entry);
    }

    setConversations(
      convos.map((c) => ({
        id: c.id,
        title: c.title || "Bez tytułu",
        updated_at: c.updated_at,
        messageCount: byConversation.get(c.id)?.count ?? 0,
        lastMessagePreview: truncate(byConversation.get(c.id)?.lastContent ?? "", 100),
      })),
    );
  }

  useEffect(() => {
    loadConversations();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 2500);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  async function deleteConversation(id: string) {
    const confirmed = window.confirm("Czy na pewno chcesz usunąć tę rozmowę? Tej operacji nie można cofnąć.");
    if (!confirmed) return;

    await supabase.from("messages").delete().eq("conversation_id", id);
    await supabase.from("conversations").delete().eq("id", id);

    setConversations((current) => (current ? current.filter((c) => c.id !== id) : current));
    setToast("Rozmowa usunięta");
  }

  return (
    <main className="history-shell">
      <section className="history-panel">
        <header className="history-header">
          <h1>📜 Historia rozmów</h1>
          <p className="agent-subtitle">Wszystkie Twoje rozmowy z agentem</p>
        </header>

        {conversations === null ? (
          <div className="empty-state">
            <p>⏳ Wczytuję historię rozmów...</p>
          </div>
        ) : conversations.length === 0 ? (
          <div className="empty-state">
            <p>Nie masz jeszcze żadnych rozmów. Zacznij nową!</p>
            <Link href="/chat" className="history-cta">Rozpocznij rozmowę</Link>
          </div>
        ) : (
          <ul className="history-list">
            {conversations.map((conversation) => (
              <li key={conversation.id} className="history-card">
                <Link href={`/history/${conversation.id}`} className="history-card-link">
                  <div className="history-card-top">
                    <span className="history-card-title">{conversation.title}</span>
                    <span className="history-card-date">{formatRelativeDate(conversation.updated_at)}</span>
                  </div>
                  <p className="history-card-preview">{conversation.lastMessagePreview || "Brak wiadomości"}</p>
                  <span className="history-card-count">
                    {conversation.messageCount} {pluralPL(conversation.messageCount, ["wiadomość", "wiadomości", "wiadomości"])}
                  </span>
                </Link>
                <button
                  className="history-delete-btn"
                  onClick={() => deleteConversation(conversation.id)}
                  type="button"
                  aria-label="Usuń rozmowę"
                >
                  🗑️ Usuń
                </button>
              </li>
            ))}
          </ul>
        )}

        {toast && <div className="history-toast">{toast}</div>}
      </section>
    </main>
  );
}
