import type { Metadata } from "next";
import Link from "next/link";
import { AuthProvider } from "../lib/AuthProvider";
import { NavAuthControls } from "../lib/NavAuthControls";
import "./globals.css";

export const metadata: Metadata = {
  title: "Aneta Sentinel - Threat Intel Expert",
  description: "Profesjonalna analityczka threat intelligence i operacji SOC",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pl">
      <body>
        <AuthProvider>
          <nav className="top-nav" aria-label="Główna nawigacja">
            <Link href="/" className="nav-primary">🏠 Dashboard</Link>
            <Link href="/react">🔄 ReAct</Link>
            <Link href="/travel">✈️ Podróże</Link>
            <Link href="/chat">💬 Chat</Link>
            <Link href="/history">📜 Historia</Link>
            <Link href="/agent">🤖 Agent</Link>
            <Link href="/search">🌐 Szukaj</Link>
            <Link href="/generate">🎨 Grafiki</Link>
            <Link href="/vision">👁️ Vision</Link>
            <Link href="/think">🧠 Myślenie</Link>
            <Link href="/fewshot">📚 Słownik</Link>
            <Link href="/format">📐 Formater</Link>
            <Link href="/upload">📚 Baza wiedzy</Link>
            <Link href="/knowledge">🔎 Przeglądaj bazę</Link>
            <Link href="/email-triage">📧 E-mail Triage</Link>
            <Link href="/report">📊 Raporty</Link>
            <Link href="/competitor">🏢 Konkurencja</Link>
            <Link href="/consultation">📅 Konsultacja</Link>
            <Link href="/briefing">☀️ Briefing</Link>
            <NavAuthControls />
          </nav>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
