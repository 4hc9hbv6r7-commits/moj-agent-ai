"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const scenarioPrompts = [
  "Planuję weekend w Krakowie. Sprawdź pogodę, znajdź ciekawe miejsca w Wikipedii, i powiedz czy są jakieś święta w ten weekend",
  "Mam 5000 EUR do wydania. Przelicz na PLN, sprawdź ile to w dolarach, i zapisz wszystkie kursy w notatkach",
  "Porównaj pogodę w Warszawie, Berlinie i Paryżu. Który z tych miast ma dziś najlepszą pogodę?",
  "Ile dni do następnego święta w Polsce? Jaka będzie wtedy pogoda?",
];

const tools = [
  { icon: "🧮", name: "calculator", label: "Kalkulator" },
  { icon: "🕐", name: "currentDateTime", label: "Data i czas" },
  { icon: "🌐", name: "readWebPage", label: "Czytanie stron" },
  { icon: "🌤️", name: "getWeather", label: "Pogoda" },
  { icon: "📈", name: "getExchangeRate", label: "Kursy walut NBP" },
  { icon: "📅", name: "getHolidays", label: "Święta państwowe" },
  { icon: "📚", name: "searchWikipedia", label: "Wikipedia" },
  { icon: "💾", name: "saveNote", label: "Zapisywanie notatek" },
  { icon: "📁", name: "getNotes", label: "Pobieranie notatek" },
];

function getTextFromParts(parts: Array<{ type: string; text?: string }>) {
  return parts
    .filter((part) => part.type === "text")
    .map((part) => part.text ?? "")
    .join("");
}

interface ReActSection {
  type: "think" | "observe" | "result" | "neutral";
  title: string;
  content: string;
  citation: string | null;
}

const citationPattern = /\n?📎\s*Źródł[oa]:\s*(.+)/i;

function extractCitation(text: string): { content: string; citation: string | null } {
  const match = text.match(citationPattern);
  if (!match) {
    return { content: text, citation: null };
  }
  return { content: text.slice(0, match.index).trim(), citation: match[1].trim() };
}

// Praca na strumieniu i dzielenie na sekcje ReAct
function parseReActResponse(text: string): ReActSection[] {
  const sections: ReActSection[] = [];
  
  // Dzielenie tekstu za pomocą lookahead dla nagłówków ### 🧠, ### 👁️, ### ✅
  const parts = text.split(/(?=###\s*(?:🧠|👁️|✅))/g);
  
  for (const part of parts) {
    if (!part.trim()) continue;
    
    let type: "think" | "observe" | "result" | "neutral" = "neutral";
    let title = "";
    let content = part;
    
    if (part.includes("🧠 Myślę")) {
      type = "think";
      title = "🧠 Myślę...";
      content = part.replace(/###\s*🧠\s*Myślę\.*/g, "").trim();
    } else if (part.includes("👁️ Obserwuję")) {
      type = "observe";
      title = "👁️ Obserwuję...";
      content = part.replace(/###\s*👁️\s*Obserwuję\.*/g, "").trim();
    } else if (part.includes("✅ Wynik")) {
      type = "result";
      title = "✅ Wynik końcowy";
      content = part.replace(/###\s*✅\s*Wynik\s*(końcowy)?\.*/g, "").trim();
    }

    const { content: cleanContent, citation } = extractCitation(content);
    sections.push({ type, title, content: cleanContent, citation });
  }

  if (sections.length === 0 && text.trim()) {
    const { content: cleanContent, citation } = extractCitation(text);
    sections.push({ type: "neutral", title: "", content: cleanContent, citation });
  }

  return sections;
}

export default function ReActPage() {
  const [input, setInput] = useState("");
  const [startTime, setStartTime] = useState<number | null>(null);
  const [diagnosticData, setDiagnosticData] = useState<{
    steps: number;
    tools: Record<string, number>;
    errors: number;
    elapsed: number;
    status: string;
  } | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/react",
      }),
    []
  );

  const { messages, sendMessage, status, error } = useChat({ transport });
  const isLoading = status === "submitted" || status === "streaming";

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status]);

  useEffect(() => {
    if (isLoading && !startTime) {
      setStartTime(Date.now());
    }

    if (!isLoading && startTime && messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      const toolInvocations = (lastMessage as any).toolInvocations || [];

      const toolCounts: Record<string, number> = {};
      let errorCount = 0;

      toolInvocations.forEach((tool: any) => {
        toolCounts[tool.toolName] = (toolCounts[tool.toolName] || 0) + 1;
        if (tool.result && typeof tool.result === "string" && tool.result.includes("error")) {
          errorCount++;
        }
      });

      const elapsed = Math.round((Date.now() - startTime) / 100) / 10;
      const resultStatus = errorCount > 0 ? "⚠️ Zakończone z błędami" : "✅ Ukończone";

      setDiagnosticData({
        steps: toolInvocations.length,
        tools: toolCounts,
        errors: errorCount,
        elapsed,
        status: resultStatus,
      });
      setStartTime(null);
    }
  }, [isLoading, messages, startTime]);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = input.trim();
    if (!text || isLoading) return;
    setDiagnosticData(null);
    sendMessage({ text });
    setInput("");
  }

  function sendScenario(scenario: string) {
    if (isLoading) return;
    setDiagnosticData(null);
    sendMessage({ text: scenario });
    setInput("");
  }

  return (
    <main className="chat-shell">
      <section className="chat-panel" aria-label="Agent ReAct — Autonomiczne rozumowanie">
        <header className="chat-header">
          <h1>🔄 Agent ReAct — Autonomiczne rozumowanie</h1>
          <p className="agent-subtitle">Opisz cel → agent sam zaplanuje, wywoła darmowe API i zrealizuje zadanie</p>

          <div className="tools-panel" style={{ marginBottom: "20px" }}>
            <h2 className="prompts-label" style={{ marginBottom: "8px" }}>Dostępne narzędzia API ({tools.length}):</h2>
            <div className="tools-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))" }}>
              {tools.map((t) => (
                <div key={t.name} className="tool-badge" style={{ fontSize: "0.82rem", padding: "6px 8px" }}>
                  {t.icon} {t.label}
                </div>
              ))}
            </div>
          </div>

          <div className="example-prompts">
            <h2 className="prompts-label">Wybierz gotowy scenariusz wielokrokowy:</h2>
            <div className="prompts-grid">
              {scenarioPrompts.map((scenario) => (
                <button
                  key={scenario}
                  onClick={() => sendScenario(scenario)}
                  type="button"
                  className="prompt-button"
                  disabled={isLoading}
                >
                  {scenario}
                </button>
              ))}
            </div>
          </div>
        </header>

        <div className="messages" aria-live="polite">
          {messages.length === 0 ? (
            <div className="empty-state">
              <p>Zleć agentowi zadanie powyżej lub wpisz własne. Agent użyje pętli ReAct (Myślę 🧠 → Działam ⚡ → Obserwuję 👁️).</p>
            </div>
          ) : (
            messages.map((message) => {
              const text = getTextFromParts(message.parts);
              const isUser = message.role === "user";
              
              // Obliczanie bieżącego kroku na podstawie liczby wywołań narzędzi (maxSteps wynosi 8)
              const toolCallsCount = (message as any).toolInvocations?.length ?? 0;
              const currentStep = Math.min(8, Math.max(1, toolCallsCount + (isLoading && message.id === messages[messages.length - 1].id ? 1 : 0)));
              
              return (
                <article className={`message-row ${isUser ? "user" : "assistant"}`} key={message.id}>
                  <div className="message-bubble" style={{ width: "100%", maxWidth: isUser ? "650px" : "100%" }}>
                    <div className="message-meta">
                      <span className="message-author">{isUser ? "Zlecenie" : "Agent ReAct (gemini-3.1-flash-lite)"}</span>
                    </div>

                    {isUser ? (
                      <p style={{ margin: 0 }}>{text}</p>
                    ) : (
                      <div className="react-container">
                        {/* Pasek postępu kroku */}
                        <div className="react-step-header">
                          <div className="react-step-title">
                            Pętla ReAct: Krok {currentStep} z 8
                          </div>
                          <div className="react-progress-bar-bg">
                            <div
                              className="react-progress-bar-fill"
                              style={{ width: `${(currentStep / 8) * 100}%` }}
                            />
                          </div>
                        </div>

                        {/* Strumieniowane i sformatowane sekcje ReAct */}
                        {parseReActResponse(text).map((section, idx) => {
                          if (section.type === "neutral") {
                            return (
                              <div key={idx} className="react-section neutral">
                                <div className="markdown-render">
                                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{section.content}</ReactMarkdown>
                                </div>
                                {section.citation && (
                                  <div className="citation-badge">📎 {section.citation}</div>
                                )}
                              </div>
                            );
                          }
                          return (
                            <div key={idx} className={`react-section ${section.type}`}>
                              <h3 style={{ fontSize: "1.05rem", fontWeight: "700", marginBottom: "8px", display: "flex", alignItems: "center", gap: "6px" }}>
                                {section.title}
                              </h3>
                              <div className="markdown-render">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>{section.content}</ReactMarkdown>
                              </div>
                              {section.citation && (
                                <div className="citation-badge">📎 {section.citation}</div>
                              )}
                            </div>
                          );
                        })}

                        {/* Rendering wywołań narzędzi (karty timeline) */}
                        {(message as any).toolInvocations && (message as any).toolInvocations.length > 0 && (
                          <div className="react-timeline" style={{ marginTop: "10px" }}>
                            <div style={{ fontSize: "0.8rem", fontWeight: "bold", color: "#a8a8b8", marginBottom: "6px" }}>
                              Wywołane narzędzia w tym kroku:
                            </div>
                            {(message as any).toolInvocations.map((tool: any) => {
                              const isCompleted = tool.state === "result";
                              return (
                                <div key={tool.toolCallId} className="react-tool-card">
                                  <div className="react-tool-header">
                                    <span className="react-tool-name">
                                      ⚡ {tool.toolName}
                                    </span>
                                    <span className={`react-tool-status ${tool.state}`}>
                                      {isCompleted ? "ZAKOŃCZONE" : "URUCHOMIONE..."}
                                    </span>
                                  </div>
                                  <div className="react-tool-args">
                                    <strong>Parametry:</strong> {JSON.stringify(tool.args)}
                                  </div>
                                  {isCompleted && (
                                    <div className="react-tool-result">
                                      <strong>Wynik:</strong> {typeof tool.result === "string" ? tool.result : JSON.stringify(tool.result)}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </article>
              );
            })
          )}

          {isLoading && !messages.some(m => m.role === "assistant") && (
            <article className="message-row assistant">
              <div className="message-bubble thinking">
                <div className="message-meta">
                  <span className="message-author">Agent ReAct</span>
                </div>
                <p>Planowanie pierwszego kroku i wywoływanie narzędzi w pętli ReAct...</p>
              </div>
            </article>
          )}

          {error && (
            <div className="error-message" style={{ padding: "0 18px", color: "#f87171" }}>
              Błąd: Sprawdź klucz API lub połączenie z internetem. Spróbuj zadać prostsze pytanie.
            </div>
          )}

          <div ref={endRef} />
        </div>

        {diagnosticData && (
          <div style={{
            backgroundColor: "#1a1a2e",
            border: "1px solid #3a3a5e",
            borderRadius: "6px",
            padding: "12px",
            marginBottom: "12px",
            fontSize: "0.85rem",
          }}>
            <div style={{ fontWeight: "bold", marginBottom: "8px", display: "flex", gap: "6px", alignItems: "center" }}>
              🛡️ Diagnostyka
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "8px" }}>
              <div>
                <div style={{ color: "#a8a8b8" }}>Kroki: {diagnosticData.steps}/8</div>
                <div style={{
                  backgroundColor: "#2a2a4a",
                  height: "4px",
                  borderRadius: "2px",
                  overflow: "hidden",
                }}>
                  <div
                    style={{
                      height: "100%",
                      width: `${Math.min(100, (diagnosticData.steps / 8) * 100)}%`,
                      backgroundColor: diagnosticData.steps <= 3 ? "#10b981" : diagnosticData.steps <= 6 ? "#f59e0b" : "#ef4444",
                      transition: "width 0.3s",
                    }}
                  />
                </div>
              </div>
              <div>
                <div style={{ color: "#a8a8b8" }}>Czas: {diagnosticData.elapsed}s</div>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div style={{ color: "#a8a8b8" }}>
                Narzędzia: {Object.entries(diagnosticData.tools).map(([name, count]) => `${name}(${count})`).join(", ") || "—"}
              </div>
              <div style={{ color: diagnosticData.errors > 0 ? "#ef4444" : "#10b981" }}>
                Błędy: {diagnosticData.errors}
              </div>
            </div>
            <div style={{ marginTop: "8px", textAlign: "center", color: diagnosticData.errors > 0 ? "#f59e0b" : "#10b981" }}>
              {diagnosticData.status}
            </div>
          </div>
        )}

        <form className="composer" onSubmit={onSubmit}>
          <input
            onChange={(e) => setInput(e.target.value)}
            value={input}
            placeholder="Opisz co chcesz osiągnąć..."
            type="text"
            disabled={isLoading}
          />
          <button disabled={isLoading} type="submit">
            {isLoading ? "Praca..." : "Zleć"}
          </button>
        </form>
      </section>
    </main>
  );
}
