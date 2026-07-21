"use client";

import { FormEvent, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

interface DocumentSummary {
  title: string;
  chunkCount: number;
  createdAt: string;
}

const placeholderExamples = [
  {
    label: "Cennik",
    text: "Pakiet Basic: 99 zł/mies. Pakiet Premium: 299 zł/mies...",
  },
  {
    label: "FAQ",
    text: "Q: Jak mogę anulować subskrypcję? A: Wyślij email na...",
  },
  {
    label: "Regulamin",
    text: "§1. Postanowienia ogólne. 1.1 Niniejszy regulamin...",
  },
];

export default function UploadPage() {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [documents, setDocuments] = useState<DocumentSummary[] | null>(null);

  async function loadDocuments() {
    const { data, error } = await supabase
      .from("documents")
      .select("title, created_at")
      .order("created_at", { ascending: false });

    if (error || !data) {
      setDocuments([]);
      return;
    }

    const byTitle = new Map<string, { chunkCount: number; createdAt: string }>();
    for (const row of data) {
      const existing = byTitle.get(row.title);
      if (existing) {
        existing.chunkCount += 1;
      } else {
        byTitle.set(row.title, { chunkCount: 1, createdAt: row.created_at });
      }
    }

    setDocuments(
      Array.from(byTitle.entries()).map(([docTitle, info]) => ({
        title: docTitle,
        chunkCount: info.chunkCount,
        createdAt: info.createdAt,
      })),
    );
  }

  useEffect(() => {
    loadDocuments();
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!title.trim() || !content.trim() || isLoading) {
      return;
    }

    setIsLoading(true);
    setProgress(null);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/upload-knowledge", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: title.trim(), content }),
      });

      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Nie udało się zapisać dokumentu");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line);

          if (event.type === "progress") {
            setProgress({ current: event.current, total: event.total });
          } else if (event.type === "error") {
            throw new Error(event.message);
          } else if (event.type === "done") {
            setSuccessMessage(`✅ Zapisano ${event.chunks_saved} fragmentów!`);
            setTitle("");
            setContent("");
            await loadDocuments();
          }
        }
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Nie udało się zapisać dokumentu");
    } finally {
      setIsLoading(false);
      setProgress(null);
    }
  }

  async function deleteDocument(docTitle: string) {
    const confirmed = window.confirm(`Czy na pewno chcesz usunąć dokument "${docTitle}"?`);
    if (!confirmed) return;

    await supabase.from("documents").delete().eq("title", docTitle);
    setDocuments((current) => (current ? current.filter((d) => d.title !== docTitle) : current));
  }

  return (
    <main className="history-shell">
      <section className="history-panel">
        <header className="history-header">
          <h1>📚 Baza wiedzy</h1>
          <p className="agent-subtitle">Wklej tekst — agent będzie z niego korzystał</p>
        </header>

        <div className="upload-form-section">
          <form onSubmit={onSubmit} className="upload-form">
            <input
              aria-label="Tytuł dokumentu"
              className="upload-input"
              onChange={(event) => setTitle(event.currentTarget.value)}
              placeholder="Np. Cennik 2026, FAQ, Regulamin firmy"
              value={title}
            />
            <textarea
              aria-label="Treść dokumentu"
              className="upload-textarea"
              onChange={(event) => setContent(event.currentTarget.value)}
              placeholder="Wklej tutaj treść dokumentu..."
              value={content}
            />
            <button
              className="generate-button"
              disabled={isLoading || !title.trim() || !content.trim()}
              type="submit"
            >
              {isLoading ? "📤 Zapisuję..." : "📤 Zapisz w bazie wiedzy"}
            </button>

            {progress && (
              <div className="upload-progress" aria-live="polite">
                <div className="upload-progress-bar">
                  <div
                    className="upload-progress-fill"
                    style={{ width: `${(progress.current / progress.total) * 100}%` }}
                  />
                </div>
                <p className="upload-progress-label">
                  Przetwarzam fragment {progress.current} z {progress.total}...
                </p>
              </div>
            )}

            {successMessage && <p className="upload-success">{successMessage}</p>}
            {errorMessage && <p className="error-message">{errorMessage}</p>}
          </form>

          <div className="example-prompts">
            <p className="prompts-label">Przykładowe dokumenty:</p>
            <div className="prompts-grid">
              {placeholderExamples.map((example) => (
                <button
                  key={example.label}
                  className="prompt-button"
                  onClick={() => setContent(example.text)}
                  type="button"
                >
                  <strong>{example.label}:</strong> {example.text}
                </button>
              ))}
            </div>
          </div>
        </div>

        {documents === null ? (
          <div className="empty-state">
            <p>⏳ Wczytuję zapisane dokumenty...</p>
          </div>
        ) : documents.length === 0 ? (
          <div className="empty-state">
            <p>Nie masz jeszcze żadnych dokumentów w bazie wiedzy.</p>
          </div>
        ) : (
          <ul className="history-list">
            {documents.map((doc) => (
              <li key={doc.title} className="history-card">
                <div className="history-card-link">
                  <div className="history-card-top">
                    <span className="history-card-title">{doc.title}</span>
                    <span className="history-card-date">
                      {new Date(doc.createdAt).toLocaleDateString("pl-PL", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                  <span className="history-card-count">{doc.chunkCount} fragmentów</span>
                </div>
                <button
                  className="history-delete-btn"
                  onClick={() => deleteDocument(doc.title)}
                  type="button"
                  aria-label="Usuń dokument"
                >
                  🗑️ Usuń
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
