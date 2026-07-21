"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const travelScenarios = [
  "Planuję weekend w Berlinie. Budżet: 2000 PLN",
  "Lecę do Paryża na tydzień w sierpniu",
  "Wycieczka do Pragi z rodziną na 3 dni",
  "Podróż służbowa do Londynu w przyszłym tygodniu",
  "Porównaj Barcelonę i Lizbonę na wakacje",
];

function getTextFromParts(parts: Array<{ type: string; text?: string }>) {
  return parts
    .filter((part) => part.type === "text")
    .map((part) => part.text ?? "")
    .join("");
}

interface TravelSection {
  type: "summary" | "weather" | "budget" | "dates" | "attractions" | "checklist" | "neutral";
  title: string;
  content: string;
}

function parseTravelResponse(text: string): TravelSection[] {
  const sections: TravelSection[] = [];

  const parts = text.split(/(?=###\s*)/g);

  for (const part of parts) {
    if (!part.trim()) continue;

    let type: TravelSection["type"] = "neutral";
    let title = "";
    let content = part;

    if (part.includes("📋 Podsumowanie")) {
      type = "summary";
      title = "📋 Podsumowanie";
      content = part.replace(/###\s*📋\s*Podsumowanie\.*/g, "").trim();
    } else if (part.includes("🌤️ Pogoda")) {
      type = "weather";
      title = "🌤️ Pogoda";
      content = part.replace(/###\s*🌤️\s*Pogoda\.*/g, "").trim();
    } else if (part.includes("💰 Budżet")) {
      type = "budget";
      title = "💰 Budżet";
      content = part.replace(/###\s*💰\s*Budżet\.*/g, "").trim();
    } else if (part.includes("📅 Ważne daty")) {
      type = "dates";
      title = "📅 Ważne daty";
      content = part.replace(/###\s*📅\s*Ważne\s*daty\.*/g, "").trim();
    } else if (part.includes("🏛️ Co zobaczyć")) {
      type = "attractions";
      title = "🏛️ Co zobaczyć";
      content = part.replace(/###\s*🏛️\s*Co\s*zobaczyć\.*/g, "").trim();
    } else if (part.includes("✅ Checklist")) {
      type = "checklist";
      title = "✅ Checklist przed wyjazdem";
      content = part.replace(/###\s*✅\s*Checklist\s*(przed\s*wyjazdem)?\.*/g, "").trim();
    } else if (part.includes("🗺️ Plan podróży")) {
      type = "summary";
      title = "🗺️ Plan podróży";
      content = part.replace(/###\s*🗺️\s*Plan\s*podróży[^:]*:/g, "").trim();
    }

    sections.push({ type, title, content });
  }

  if (sections.length === 0 && text.trim()) {
    sections.push({ type: "neutral", title: "", content: text });
  }

  return sections;
}

const sectionColors: Record<TravelSection["type"], { bg: string; border: string }> = {
  summary: { bg: "#0f172a", border: "#1e293b" },
  weather: { bg: "#0c2340", border: "#1e40af" },
  budget: { bg: "#1a0a0a", border: "#7c2d12" },
  dates: { bg: "#0a1428", border: "#0d3c9e" },
  attractions: { bg: "#1a0a1a", border: "#6b21a8" },
  checklist: { bg: "#0a1f0f", border: "#15803d" },
  neutral: { bg: "transparent", border: "transparent" },
};

export default function TravelPage() {
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
        api: "/api/travel",
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
      <section className="chat-panel" aria-label="Asystent podróży AI">
        <header className="chat-header">
          <h1>✈️ Asystent podróży AI</h1>
          <p className="agent-subtitle">Powiedz dokąd jedziesz — agent zaplanuje wszystko z prawdziwymi danymi</p>

          <div className="example-prompts">
            <h2 className="prompts-label">Wybierz scenariusz lub opisz swoją podróż:</h2>
            <div className="prompts-grid">
              {travelScenarios.map((scenario) => (
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
              <p>💡 Opisz gdzie jedziesz, a asystent zbierze wszystko co ważne: pogodę, kursy walut, święta, atrakcje i praktyczne rady.</p>
            </div>
          ) : (
            messages.map((message) => {
              const text = getTextFromParts(message.parts);
              const isUser = message.role === "user";

              return (
                <article className={`message-row ${isUser ? "user" : "assistant"}`} key={message.id}>
                  <div className="message-bubble" style={{ width: "100%", maxWidth: isUser ? "650px" : "100%" }}>
                    <div className="message-meta">
                      <span className="message-author">{isUser ? "Zapytanie" : "Asystent podróży (gemini-3.1-flash-lite)"}</span>
                    </div>

                    {isUser ? (
                      <p style={{ margin: 0 }}>{text}</p>
                    ) : (
                      <div className="travel-container">
                        {parseTravelResponse(text).map((section, idx) => {
                          const colors = sectionColors[section.type];
                          return (
                            <div
                              key={idx}
                              className="travel-section"
                              style={{
                                backgroundColor: colors.bg,
                                borderLeft: colors.border ? `4px solid ${colors.border}` : "none",
                                padding: "12px",
                                marginBottom: "8px",
                                borderRadius: "4px",
                              }}
                            >
                              {section.title && (
                                <h3 style={{ fontSize: "0.95rem", fontWeight: "700", marginBottom: "8px", margin: "0 0 8px 0" }}>
                                  {section.title}
                                </h3>
                              )}
                              <div className="markdown-render">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>{section.content}</ReactMarkdown>
                              </div>
                            </div>
                          );
                        })}

                        {(message as any).toolInvocations && (message as any).toolInvocations.length > 0 && (
                          <div className="travel-timeline" style={{ marginTop: "12px" }}>
                            <div style={{ fontSize: "0.75rem", fontWeight: "bold", color: "#a8a8b8", marginBottom: "6px" }}>
                              Wykorzystane narzędzia:
                            </div>
                            {(message as any).toolInvocations.map((tool: any) => {
                              const isCompleted = tool.state === "result";
                              return (
                                <div key={tool.toolCallId} className="travel-tool-card" style={{ fontSize: "0.8rem" }}>
                                  <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "4px" }}>
                                    <span style={{ fontWeight: "bold" }}>📍 {tool.toolName}</span>
                                    <span style={{ color: isCompleted ? "#10b981" : "#f59e0b", fontSize: "0.7rem", fontWeight: "bold" }}>
                                      {isCompleted ? "✓ OK" : "..."}
                                    </span>
                                  </div>
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
                  <span className="message-author">Asystent podróży</span>
                </div>
                <p>Zbieranie informacji o Twojej podróży z różnych źródeł...</p>
              </div>
            </article>
          )}

          {error && (
            <div className="error-message" style={{ padding: "0 18px", color: "#f87171" }}>
              Błąd: Sprawdź klucz API lub połączenie z internetem. Spróbuj zadać pytanie jeszcze raz.
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
                <div style={{ color: "#a8a8b8" }}>Kroki: {diagnosticData.steps}/10</div>
                <div style={{
                  backgroundColor: "#2a2a4a",
                  height: "4px",
                  borderRadius: "2px",
                  overflow: "hidden",
                }}>
                  <div
                    style={{
                      height: "100%",
                      width: `${Math.min(100, (diagnosticData.steps / 10) * 100)}%`,
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
            placeholder="Np. Lecę do Barcelony na weekend..."
            type="text"
            disabled={isLoading}
          />
          <button disabled={isLoading} type="submit">
            {isLoading ? "Planowanie..." : "Zaplanuj"}
          </button>
        </form>
      </section>
    </main>
  );
}
