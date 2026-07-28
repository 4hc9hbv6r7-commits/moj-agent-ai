"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "../../lib/AuthProvider";
import { supabase } from "../../lib/supabase";

interface BriefingSummary {
  id: string;
  content: string;
  date: string;
  created_at: string;
}

function formatBriefingDate(dateStr: string): string {
  const date = new Date(`${dateStr}T00:00:00Z`);
  const full = date.toLocaleDateString("pl-PL", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  const weekday = date.toLocaleDateString("pl-PL", { weekday: "long", timeZone: "UTC" });
  return `${full}, ${weekday}`;
}

function truncate(text: string, max: number) {
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

export default function BriefingsPage() {
  const { session } = useAuth();
  const [briefings, setBriefings] = useState<BriefingSummary[] | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadBriefings() {
    const { data, error: fetchError } = await supabase
      .from("briefings")
      .select("id, content, date, created_at")
      .order("created_at", { ascending: false })
      .limit(30);

    if (fetchError) {
      setError(fetchError.message);
      return;
    }

    setError(null);
    setBriefings(data ?? []);
  }

  useEffect(() => {
    loadBriefings();
  }, []);

  async function generateNow() {
    if (isGenerating || !session?.access_token) return;

    setIsGenerating(true);
    setError(null);

    try {
      const response = await fetch("/api/briefings/generate", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? "Nie udało się wygenerować briefingu");
      }

      await loadBriefings();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <main className="history-shell">
      <section className="history-panel">
        <header className="history-header">
          <h1>📰 Briefingi</h1>
          <p className="agent-subtitle">Automatyczne podsumowania dnia od Twojego agenta</p>
          <div className="report-actions">
            <button className="copy-draft-button" disabled={isGenerating} onClick={generateNow} type="button">
              {isGenerating ? "Generuję..." : "🔄 Wygeneruj teraz"}
            </button>
          </div>
        </header>

        {error && <p className="error-message">{error}</p>}

        {briefings === null ? (
          <div className="empty-state">
            <p>⏳ Wczytuję briefingi...</p>
          </div>
        ) : briefings.length === 0 ? (
          <div className="empty-state">
            <p>Brak briefingów. Cron job wygeneruje pierwszy jutro rano!</p>
            <button className="copy-draft-button" disabled={isGenerating} onClick={generateNow} type="button">
              {isGenerating ? "Generuję..." : "🔄 Wygeneruj teraz"}
            </button>
          </div>
        ) : (
          <ul className="history-list">
            {briefings.map((briefing) => (
              <li key={briefing.id} className="history-card">
                <Link href={`/briefings/${briefing.id}`} className="history-card-link">
                  <div className="history-card-top">
                    <span className="history-card-title">{formatBriefingDate(briefing.date)}</span>
                  </div>
                  <p className="history-card-preview">{truncate(briefing.content, 150)}</p>
                  <span className="history-card-count">✅ wygenerowany automatycznie (z cron)</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
