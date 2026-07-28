"use client";

import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { supabase } from "../../lib/supabase";

interface Briefing {
  id: string;
  content: string;
  date: string;
  created_at: string;
}

export default function BriefingPage() {
  const [briefing, setBriefing] = useState<Briefing | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  async function loadLatestBriefing() {
    const { data, error: fetchError } = await supabase
      .from("briefings")
      .select("id, content, date, created_at")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fetchError) {
      setError(fetchError.message);
      return;
    }

    setError(null);
    setBriefing(data ?? null);
  }

  useEffect(() => {
    loadLatestBriefing();
  }, []);

  async function refresh() {
    setIsRefreshing(true);
    await loadLatestBriefing();
    setIsRefreshing(false);
  }

  return (
    <main className="history-shell">
      <section className="history-panel">
        <header className="history-header">
          <h1>☀️ Poranny briefing</h1>
          <p className="agent-subtitle">Ostatni briefing wygenerowany przez endpoint /api/cron/morning</p>
        </header>

        {briefing === undefined ? (
          <div className="empty-state">
            <p>⏳ Wczytuję briefing...</p>
          </div>
        ) : error ? (
          <div className="empty-state">
            <p>❌ Nie udało się wczytać briefingu: {error}</p>
          </div>
        ) : briefing === null ? (
          <div className="empty-state">
            <p>Nie ma jeszcze żadnego briefingu. Odpal endpoint /api/cron/morning, żeby go wygenerować.</p>
          </div>
        ) : (
          <>
            <p className="history-card-date">
              {new Date(briefing.created_at).toLocaleString("pl-PL", { timeZone: "Europe/Warsaw" })}
            </p>
            <div className="markdown-render">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{briefing.content}</ReactMarkdown>
            </div>
          </>
        )}

        <div className="report-actions">
          <button className="copy-draft-button" disabled={isRefreshing} onClick={refresh} type="button">
            {isRefreshing ? "Odświeżam..." : "🔄 Odśwież"}
          </button>
        </div>
      </section>
    </main>
  );
}
