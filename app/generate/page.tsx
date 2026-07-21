"use client";

import { FormEvent, useRef, useState } from "react";

const examplePrompts = [
  "Minimalistyczne logo kawiarni w stylu japońskim",
  "Post na Instagram: kawa latte art, ciepłe światło, widok z góry",
  "Kreacja reklamowa: wyprzedaż letnia -50%, nowoczesny design",
  "Ikona aplikacji: robot AI, gradient fioletowo-niebieski, flat design",
  "Infografika: 5 kroków do produktywności, pastelowe kolory",
  "Zdjęcie produktowe: elegancki zegarek na ciemnym tle",
];

export default function GeneratePage() {
  const [prompt, setPrompt] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function generateImage(text: string) {
    if (!text.trim()) return;

    setIsLoading(true);
    try {
      const res = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: text }),
      });

      if (!res.ok) throw new Error("Generation failed");

      const { image: base64, text: responseText } = await res.json();
      setImage(base64);
      setText(responseText);
    } catch (err) {
      alert("Nie udało się wygenerować obrazu. Spróbuj ponownie.");
    } finally {
      setIsLoading(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    await generateImage(prompt);
  }

  function fillPrompt(examplePrompt: string) {
    setPrompt(examplePrompt);
  }

  function downloadImage() {
    if (!image) return;

    const link = document.createElement("a");
    link.href = image;
    link.download = "ai-generated.png";
    link.click();
  }

  function regenerate() {
    if (prompt) generateImage(prompt);
  }

  return (
    <main className="chat-shell">
      <section className="chat-panel" aria-label="Generator grafik AI">
        <header className="chat-header">
          <h1>🎨 Generator grafik AI</h1>
          <p className="agent-subtitle">Opisz co chcesz — AI stworzy obraz w kilka sekund.</p>
        </header>

        <div className="messages" aria-live="polite">
          <div className="generate-form-section">
            <form onSubmit={onSubmit} className="generate-form">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.currentTarget.value)}
                placeholder="Opisz obraz który chcesz wygenerować..."
                rows={4}
                className="generate-textarea"
              />
              <button disabled={isLoading || !prompt.trim()} type="submit" className="generate-button">
                {isLoading ? "🎨 Generuję... (5-15 sekund)" : "🎨 Generuj"}
              </button>
            </form>

            <div className="example-prompts">
              <p className="prompts-label">Przykładowe prompty:</p>
              <div className="prompts-grid">
                {examplePrompts.map((ex) => (
                  <button
                    key={ex}
                    onClick={() => fillPrompt(ex)}
                    className="prompt-button"
                    type="button"
                  >
                    {ex}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {image && (
            <div className="generate-result">
              <img src={image} alt="Generated" className="generated-image" />
              {text && <p className="image-description">{text}</p>}
              <div className="image-actions">
                <button onClick={downloadImage} className="action-button">
                  💾 Pobierz
                </button>
                <button onClick={regenerate} disabled={isLoading} className="action-button">
                  🔄 Ponownie
                </button>
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
