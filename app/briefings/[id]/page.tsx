"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { supabase } from "../../../lib/supabase";

interface Briefing {
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

export default function BriefingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("briefings")
        .select("id, content, date, created_at")
        .eq("id", id)
        .maybeSingle();

      if (!data) {
        setNotFound(true);
        return;
      }

      setBriefing(data);
    }

    load();
  }, [id]);

  async function copyContent() {
    if (!briefing) return;
    await navigator.clipboard.writeText(briefing.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (notFound) {
    return (
      <main className="history-shell">
        <section className="history-panel">
          <div className="empty-state">
            <p>Nie znaleziono tego briefingu.</p>
            <Link href="/briefings" className="history-cta">← Wróć do listy</Link>
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
            <Link href="/briefings" className="history-back-link">← Wróć do listy</Link>
          </div>
          {briefing && <h1>{formatBriefingDate(briefing.date)}</h1>}
        </header>

        {briefing === null ? (
          <div className="empty-state">
            <p>⏳ Wczytuję briefing...</p>
          </div>
        ) : (
          <>
            <div className="markdown-render">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{briefing.content}</ReactMarkdown>
            </div>
            <div className="report-actions">
              <button className="copy-draft-button" onClick={copyContent} type="button">
                {copied ? "✅ Skopiowano" : "📋 Kopiuj"}
              </button>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
