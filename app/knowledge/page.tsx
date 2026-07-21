"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";

interface DocumentChunk {
  content: string;
  chunkIndex: number;
  createdAt: string;
}

interface DocumentGroup {
  title: string;
  createdAt: string;
  chunks: DocumentChunk[];
}

interface SearchResult {
  title: string;
  content: string;
  similarity: number;
}

export default function KnowledgePage() {
  const [documents, setDocuments] = useState<DocumentGroup[] | null>(null);
  const [expandedTitle, setExpandedTitle] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[] | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  async function loadDocuments() {
    const { data, error } = await supabase
      .from("documents")
      .select("title, content, created_at, metadata")
      .order("created_at", { ascending: true });

    if (error || !data) {
      setDocuments([]);
      return;
    }

    const byTitle = new Map<string, DocumentGroup>();
    for (const row of data) {
      const existing = byTitle.get(row.title);
      const chunkIndex = (row.metadata as { chunk_index?: number } | null)?.chunk_index ?? 0;
      const chunk: DocumentChunk = { content: row.content, chunkIndex, createdAt: row.created_at };

      if (existing) {
        existing.chunks.push(chunk);
      } else {
        byTitle.set(row.title, { title: row.title, createdAt: row.created_at, chunks: [chunk] });
      }
    }

    const groups = Array.from(byTitle.values()).map((group) => ({
      ...group,
      chunks: group.chunks.sort((a, b) => a.chunkIndex - b.chunkIndex),
    }));

    setDocuments(groups);
  }

  useEffect(() => {
    loadDocuments();
  }, []);

  const totalChunks = useMemo(
    () => (documents ? documents.reduce((sum, doc) => sum + doc.chunks.length, 0) : 0),
    [documents],
  );

  async function onSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = query.trim();
    if (!trimmed || isSearching) return;

    setIsSearching(true);
    setSearchError(null);
    setSearchResults(null);

    try {
      const embedRes = await fetch("/api/embed", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: trimmed }),
      });

      if (!embedRes.ok) throw new Error("Nie udało się wygenerować embeddingu zapytania");
      const { embedding } = await embedRes.json();

      const { data, error } = await supabase.rpc("match_documents", {
        query_embedding: embedding,
        match_threshold: 0,
        match_count: 10,
      });

      if (error) throw new Error(error.message);

      setSearchResults(
        (data ?? []).map((row: { title: string; content: string; similarity: number }) => ({
          title: row.title,
          content: row.content,
          similarity: row.similarity,
        })),
      );
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : "Wyszukiwanie nie powiodło się");
    } finally {
      setIsSearching(false);
    }
  }

  return (
    <main className="history-shell">
      <section className="history-panel">
        <header className="history-header">
          <h1>🔎 Podgląd bazy wiedzy</h1>
          <p className="agent-subtitle">
            {documents === null
              ? "Wczytuję..."
              : `${totalChunks} fragmentów z ${documents.length} dokumentów`}
          </p>
        </header>

        <div className="upload-form-section">
          <form onSubmit={onSearch} className="upload-form">
            <input
              aria-label="Szukaj w bazie wiedzy"
              className="upload-input"
              onChange={(event) => setQuery(event.currentTarget.value)}
              placeholder="Szukaj w bazie wiedzy... (np. VIP, rezygnacja)"
              value={query}
            />
            <button className="generate-button" disabled={isSearching || !query.trim()} type="submit">
              {isSearching ? "🔎 Szukam..." : "🔎 Testuj wyszukiwanie"}
            </button>
          </form>

          {searchError && <p className="error-message">{searchError}</p>}

          {searchResults && (
            <ul className="history-list" style={{ padding: 0 }}>
              {searchResults.length === 0 ? (
                <li className="empty-state">
                  <p>Brak wyników — baza wiedzy jest pusta lub nic nie pasuje.</p>
                </li>
              ) : (
                searchResults.map((result, idx) => (
                  <li key={idx} className="history-card">
                    <div className="history-card-link">
                      <div className="history-card-top">
                        <span className="history-card-title">{result.title}</span>
                        <span className="history-card-date">
                          similarity: {result.similarity.toFixed(3)}
                        </span>
                      </div>
                      <p className="history-card-preview">{result.content}</p>
                    </div>
                  </li>
                ))
              )}
            </ul>
          )}
        </div>

        {documents === null ? (
          <div className="empty-state">
            <p>⏳ Wczytuję dokumenty...</p>
          </div>
        ) : documents.length === 0 ? (
          <div className="empty-state">
            <p>Baza wiedzy jest pusta. Wrzuć dokument na stronie /upload.</p>
          </div>
        ) : (
          <ul className="history-list">
            {documents.map((doc) => {
              const isExpanded = expandedTitle === doc.title;
              return (
                <li key={doc.title} className="history-card">
                  <button
                    type="button"
                    className="history-card-link"
                    style={{ width: "100%", textAlign: "left", background: "none", border: "none", cursor: "pointer" }}
                    onClick={() => setExpandedTitle(isExpanded ? null : doc.title)}
                  >
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
                    <span className="history-card-count">
                      {doc.chunks.length} fragmentów — {isExpanded ? "kliknij aby zwinąć" : "kliknij aby zobaczyć fragmenty"}
                    </span>
                  </button>

                  {isExpanded && (
                    <div style={{ padding: "0 16px 16px" }}>
                      {doc.chunks.map((chunk) => (
                        <div key={chunk.chunkIndex} className="react-tool-card">
                          <div className="react-tool-header">
                            <span className="react-tool-name">Fragment {chunk.chunkIndex + 1}</span>
                          </div>
                          <div className="react-tool-args">{chunk.content}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
