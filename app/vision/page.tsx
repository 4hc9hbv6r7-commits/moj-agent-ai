"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

const exampleQuestions = [
  "Co widzisz na tym obrazie?",
  "Wyciągnij cały tekst z tego screena",
  "Opisz to w 3 zdaniach",
  "Jakie kolory dominują? Podaj kody HEX",
  "Opisz design i layout",
];

function getTextFromParts(parts: Array<{ type: string; text?: string }>) {
  return parts
    .filter((part) => part.type === "text")
    .map((part) => part.text ?? "")
    .join("");
}

export default function VisionPage() {
  const [input, setInput] = useState("");
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement | null>(null);
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: { model: "flash", image: attachedImage },
      }),
    [attachedImage]
  );
  const { messages, sendMessage, status, error } = useChat({ transport });
  const isLoading = status === "submitted" || status === "streaming";

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status]);

  function handlePaste(e: React.ClipboardEvent) {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) handleFile(file);
      }
    }
  }

  function handleFile(file: File) {
    if (!file.type.startsWith("image/")) {
      alert("Akceptuję tylko obrazy (PNG, JPG, GIF, WEBP)");
      return;
    }

    if (file.size > 4 * 1024 * 1024) {
      alert("Max 4MB. Zrób screenshot fragmentu.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = (e.target?.result as string).split(",")[1];
      setAttachedImage(base64);
    };
    reader.readAsDataURL(file);
  }

  function handleDrag(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = input.trim();
    if (!text || isLoading || !attachedImage) return;

    sendMessage({ text });
    setInput("");
  }

  function askQuestion(question: string) {
    if (!attachedImage || isLoading) return;
    sendMessage({ text: question });
    setInput("");
  }

  return (
    <main className="chat-shell">
      <section className="chat-panel" aria-label="Analiza obrazów">
        <header className="chat-header">
          <h1>👁️ Agent Vision</h1>
          <p className="agent-subtitle">Wklej screenshot, wrzuć plik lub przeciągnij obraz.</p>
        </header>

        {!attachedImage ? (
          <div className="drop-zone" onDragEnter={handleDrag} onDragOver={handleDrag} onDragLeave={handleDrag} onDrop={handleDrop}>
            <div className="drop-zone-content">
              <p>📸 Ctrl+V - wklej screenshot</p>
              <p>📁 Kliknij - wybierz plik</p>
              <p>🖱️ Przeciągnij - upuść obraz</p>
            </div>
          </div>
        ) : (
          <>
            <div className="image-preview-section">
              <img src={`data:image/png;base64,${attachedImage}`} alt="Preview" className="image-preview" />
              <button onClick={() => setAttachedImage(null)} className="remove-image-btn">
                ✕ Usuń obraz
              </button>
            </div>

            {attachedImage && (
              <div className="quick-questions">
                {exampleQuestions.map((q) => (
                  <button
                    key={q}
                    onClick={() => askQuestion(q)}
                    disabled={isLoading}
                    className="quick-question-btn"
                    type="button"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        <div className="messages" aria-live="polite" style={{ minHeight: attachedImage ? "200px" : "0" }}>
          {messages.map((message) => {
            const text = getTextFromParts(message.parts);
            const isUser = message.role === "user";

            return (
              <article className={`message-row ${isUser ? "user" : "assistant"}`} key={message.id}>
                <div className="message-bubble">
                  <div className="message-meta">
                    <span className="message-author">{isUser ? "Ty" : "Vision Agent"}</span>
                  </div>
                  <p>{text}</p>
                </div>
              </article>
            );
          })}

          {isLoading && (
            <article className="message-row assistant">
              <div className="message-bubble thinking">
                <div className="message-meta">
                  <span className="message-author">Vision Agent</span>
                </div>
                <p>Analizuję obraz...</p>
              </div>
            </article>
          )}

          {error && <p className="error-message">Nie udało się przeanalizować obrazu.</p>}

          <div ref={endRef} />
        </div>

        {attachedImage && (
          <form className="composer" onSubmit={onSubmit} onPaste={handlePaste}>
            <input
              aria-label="Pytanie o obraz"
              onChange={(event) => setInput(event.currentTarget.value)}
              placeholder="Zadaj pytanie o ten obraz..."
              value={input}
              onPaste={handlePaste}
            />
            <button disabled={isLoading || !input.trim()} type="submit">
              Wyślij
            </button>
          </form>
        )}

        <input ref={fileInputRef} type="file" accept="image/*" onChange={(e) => e.target.files && handleFile(e.target.files[0])} style={{ display: "none" }} />
      </section>
    </main>
  );
}
