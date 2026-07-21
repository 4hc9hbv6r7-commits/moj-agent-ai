"use client";

import { FormEvent, useState } from "react";
import { supabase } from "../../lib/supabase";

type Mode = "signin" | "signup";

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isLoading) return;

    setIsLoading(true);
    setError(null);
    setInfoMessage(null);

    try {
      if (mode === "signup") {
        const { error: signUpError, data } = await supabase.auth.signUp({ email, password });
        if (signUpError) throw signUpError;

        if (!data.session) {
          setInfoMessage("Konto utworzone! Sprawdź email, aby potwierdzić rejestrację, a potem się zaloguj.");
          setMode("signin");
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Coś poszło nie tak");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="login-shell">
      <section className="login-panel">
        <h1>🛡️ Aneta Sentinel</h1>
        <p className="agent-subtitle">
          {mode === "signin" ? "Zaloguj się do swojego konta" : "Załóż nowe konto"}
        </p>

        <form className="login-form" onSubmit={onSubmit}>
          <label className="login-field">
            <span>Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.currentTarget.value)}
              placeholder="ty@example.com"
              autoComplete="email"
            />
          </label>

          <label className="login-field">
            <span>Hasło</span>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(event) => setPassword(event.currentTarget.value)}
              placeholder="••••••••"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
            />
          </label>

          {error && <p className="error-message">{error}</p>}
          {infoMessage && <p className="login-info">{infoMessage}</p>}

          <button className="generate-button" type="submit" disabled={isLoading}>
            {isLoading
              ? "⏳ Chwilę..."
              : mode === "signin"
                ? "Zaloguj się"
                : "Zarejestruj się"}
          </button>
        </form>

        <button
          type="button"
          className="login-toggle"
          onClick={() => {
            setMode((current) => (current === "signin" ? "signup" : "signin"));
            setError(null);
            setInfoMessage(null);
          }}
        >
          {mode === "signin" ? "Nie masz konta? Zarejestruj się" : "Masz już konto? Zaloguj się"}
        </button>
      </section>
    </main>
  );
}
