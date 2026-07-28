"use client";

import { useEffect, useState } from "react";
import { useAuth } from "../../lib/AuthProvider";

interface Slot {
  time: string;
  available: boolean;
}

function todayIsoDate(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export default function ConsultationPage() {
  const { session } = useAuth();
  const [date, setDate] = useState(todayIsoDate());
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<{ date: string; time: string; emailSent: boolean } | null>(null);

  useEffect(() => {
    if (session?.user?.email) {
      setEmail(session.user.email);
    }
  }, [session]);

  useEffect(() => {
    if (!session?.access_token) {
      return;
    }

    let cancelled = false;
    setIsLoadingSlots(true);
    setSlotsError(null);
    setSelectedTime(null);

    fetch(`/api/consultation-slots?date=${date}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? "Nie udało się pobrać dostępnych terminów");
        }
        return res.json();
      })
      .then((data) => {
        if (!cancelled) {
          setSlots(data.slots ?? []);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setSlotsError(err instanceof Error ? err.message : String(err));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingSlots(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [date, session?.access_token]);

  async function submitBooking(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedTime || !name.trim() || !email.trim() || isSubmitting || !session?.access_token) {
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const response = await fetch("/api/consultation", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), date, time: selectedTime, message: message.trim() }),
      });

      const responseBody = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(responseBody.error ?? "Nie udało się złożyć rezerwacji");
      }

      setConfirmed({ date, time: selectedTime, emailSent: Boolean(responseBody.emailSent) });
      setSlots((current) => current.map((slot) => (slot.time === selectedTime ? { ...slot, available: false } : slot)));
      setSelectedTime(null);
      setMessage("");
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="chat-shell">
      <section className="chat-panel" aria-label="Rezerwacja konsultacji">
        <header className="chat-header">
          <h1>📅 Umów konsultację</h1>
          <p className="agent-subtitle">Wybierz dzień i wolny termin — właściciel dostanie powiadomienie mailowe.</p>
        </header>

        <div className="messages" aria-live="polite">
          <div className="consultation-date-picker">
            <label htmlFor="consultation-date">Dzień</label>
            <input
              id="consultation-date"
              min={todayIsoDate()}
              onChange={(event) => setDate(event.currentTarget.value)}
              type="date"
              value={date}
            />
          </div>

          {isLoadingSlots && <p className="agent-subtitle">Sprawdzam dostępne terminy...</p>}
          {slotsError && <p className="error-message">{slotsError}</p>}

          {!isLoadingSlots && !slotsError && slots.length === 0 && (
            <div className="empty-state">
              <p>Brak godzin konsultacji w tym dniu (weekend). Wybierz dzień roboczy.</p>
            </div>
          )}

          {slots.length > 0 && (
            <div className="slot-grid">
              {slots.map((slot) => (
                <button
                  className={`slot-button ${selectedTime === slot.time ? "selected" : ""}`}
                  disabled={!slot.available}
                  key={slot.time}
                  onClick={() => setSelectedTime(slot.time)}
                  type="button"
                >
                  {slot.time} {!slot.available && "· Zajęte"}
                </button>
              ))}
            </div>
          )}

          {selectedTime && (
            <form className="consultation-form" onSubmit={submitBooking}>
              <label>
                Imię i nazwisko
                <input onChange={(event) => setName(event.currentTarget.value)} required value={name} />
              </label>
              <label>
                Email kontaktowy
                <input
                  onChange={(event) => setEmail(event.currentTarget.value)}
                  required
                  type="email"
                  value={email}
                />
              </label>
              <label>
                Temat konsultacji (opcjonalnie)
                <textarea
                  className="upload-textarea consultation-message"
                  onChange={(event) => setMessage(event.currentTarget.value)}
                  value={message}
                />
              </label>

              {submitError && <p className="error-message">{submitError}</p>}

              <button disabled={isSubmitting} type="submit">
                {isSubmitting ? "Rezerwuję..." : `📅 Zarezerwuj ${date} o ${selectedTime}`}
              </button>
            </form>
          )}

          {confirmed && (
            <div className="consultation-confirmation">
              <p>
                ✅ Zarezerwowano konsultację: {confirmed.date} o {confirmed.time}.
              </p>
              {!confirmed.emailSent && (
                <p className="error-message">
                  ⚠️ Rezerwacja zapisana, ale powiadomienie mailowe nie zostało wysłane — sprawdź konfigurację Resend.
                </p>
              )}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
