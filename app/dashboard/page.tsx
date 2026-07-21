"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface WeatherData {
  city: string;
  temperature: number;
  humidity: number;
  windSpeed: number;
  description: string;
}

interface ExchangeRate {
  currency: string;
  rate: number;
  date: string;
}

interface Holiday {
  date: string;
  localName: string;
  name: string;
}

interface TravelWarning {
  country: string;
  countryCode: string;
  riskLevel: string;
}

interface DashboardData {
  weather: WeatherData | null;
  rates: ExchangeRate[];
  holidays: Holiday[];
  currentTime: string;
  currentDay: string;
  lastUpdated: string;
  loading: boolean;
  travelWarnings: TravelWarning[];
}

const quickActions = [
  { icon: "🌍", label: "Zaplanuj podróż", href: "/travel" },
  { icon: "🔄", label: "Agent ReAct", href: "/react" },
  { icon: "💬", label: "Chat", href: "/chat" },
  { icon: "🧠", label: "Myślenie", href: "/think" },
  { icon: "🎨", label: "Grafiki", href: "/generate" },
  { icon: "📚", label: "Słownik", href: "/fewshot" },
];

function LoadingSkeleton() {
  return (
    <div style={{
      backgroundColor: "rgba(30, 30, 50, 0.5)",
      borderRadius: "8px",
      padding: "16px",
      height: "200px",
      animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
    }}>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData>({
    weather: null,
    rates: [],
    holidays: [],
    currentTime: "",
    currentDay: "",
    lastUpdated: "",
    loading: true,
    travelWarnings: [],
  });

  const fetchData = async () => {
    const startTime = new Date();
    try {
      setData((prev) => ({ ...prev, loading: true }));

      // Pogoda
      const geoRes = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=Warszawa&count=1&language=pl`
      );
      const geoData = await geoRes.json();
      const { latitude, longitude } = geoData.results[0];

      const weatherRes = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code`
      );
      const weatherData = await weatherRes.json();
      const current = weatherData.current;

      const codeMap: Record<number, string> = {
        0: "Czyste niebo",
        1: "Głównie czyste",
        2: "Częściowe zachmurzenie",
        3: "Zachmurzenie",
        45: "Mgła",
        61: "Deszcz",
        80: "Przelotne opady",
        95: "Burza",
      };

      // Waluty
      const eurRes = await fetch(
        `https://api.nbp.pl/api/exchangerates/rates/a/EUR/?format=json`
      );
      const eurData = await eurRes.json();

      const usdRes = await fetch(
        `https://api.nbp.pl/api/exchangerates/rates/a/USD/?format=json`
      );
      const usdData = await usdRes.json();

      // Święta
      const year = new Date().getFullYear();
      const holidaysRes = await fetch(
        `https://date.nager.at/api/v3/publicholidays/${year}/PL`
      );
      const holidaysData: Holiday[] = await holidaysRes.json();

      // Obecny czas
      const now = new Date();
      const days = [
        "niedziela",
        "poniedziałek",
        "wtorek",
        "środa",
        "czwartek",
        "piątek",
        "sobota",
      ];
      const dayName = days[now.getDay()];
      const currentTime = now.toLocaleString("pl-PL", {
        hour: "2-digit",
        minute: "2-digit",
      });

      const today = now.toISOString().split("T")[0];
      const ninetyDaysLater = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];

      const upcomingHolidays = holidaysData.filter((h) => h.date >= today && h.date <= ninetyDaysLater);

      // Pobierz ostrzeżenia dla popularnych krajów docelowych
      const popularCountries = [
        { code: "FR", name: "Francja" },
        { code: "IT", name: "Włochy" },
        { code: "DE", name: "Niemcy" },
        { code: "UA", name: "Ukraina" },
        { code: "TR", name: "Turcja" },
        { code: "EG", name: "Egipt" },
      ];

      const warnings: TravelWarning[] = [];

      // Fallback demo data jeśli API nie odpowiada
      const fallbackWarnings: TravelWarning[] = [
        { country: "Francja", countryCode: "FR", riskLevel: "1" },
        { country: "Włochy", countryCode: "IT", riskLevel: "1" },
        { country: "Niemcy", countryCode: "DE", riskLevel: "1" },
        { country: "Ukraina", countryCode: "UA", riskLevel: "4" },
        { country: "Turcja", countryCode: "TR", riskLevel: "2" },
        { country: "Egipt", countryCode: "EG", riskLevel: "2" },
      ];

      let hasValidData = false;
      for (const country of popularCountries) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 3000);

          const warningRes = await fetch(
            `https://www.travel-advisory.info/api?countrycode=${country.code}`,
            { signal: controller.signal }
          );
          clearTimeout(timeoutId);

          if (warningRes.ok) {
            const warningData = await warningRes.json();
            const advisory = warningData.data?.[country.code];
            if (advisory?.advisory?.level) {
              warnings.push({
                country: country.name,
                countryCode: country.code,
                riskLevel: String(advisory.advisory.level),
              });
              hasValidData = true;
            }
          }
        } catch (err) {
          // Pominąć błędy dla poszczególnych krajów
        }
      }

      // Jeśli API nie odpowiedziała, użyj fallback data
      if (!hasValidData) {
        warnings.push(...fallbackWarnings);
      }

      setData({
        weather: {
          city: "Warszawa",
          temperature: current.temperature_2m,
          humidity: current.relative_humidity_2m,
          windSpeed: current.wind_speed_10m,
          description: codeMap[current.weather_code] || "Brak danych",
        },
        rates: [
          {
            currency: "EUR",
            rate: eurData.rates[0].mid,
            date: eurData.rates[0].effectiveDate,
          },
          {
            currency: "USD",
            rate: usdData.rates[0].mid,
            date: usdData.rates[0].effectiveDate,
          },
        ],
        holidays: upcomingHolidays,
        currentTime,
        currentDay: dayName,
        lastUpdated: new Date().toLocaleTimeString("pl-PL", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        loading: false,
        travelWarnings: warnings,
      });
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
      setData((prev) => ({ ...prev, loading: false }));
    }
  };

  useEffect(() => {
    fetchData();
    const weatherInterval = setInterval(fetchData, 15 * 60 * 1000);
    return () => clearInterval(weatherInterval);
  }, []);

  const weatherEmoji =
    data.weather?.description.includes("Czyste") ||
    data.weather?.description.includes("Głównie")
      ? "☀️"
      : data.weather?.description.includes("Deszcz")
        ? "🌧️"
        : data.weather?.description.includes("Burza")
          ? "⛈️"
          : "🌤️";

  return (
    <main style={{ padding: "20px", maxWidth: "1200px", margin: "0 auto" }}>
      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .dashboard-card {
          animation: fadeIn 0.5s ease-out;
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          padding: 20px;
        }

        .weather-card {
          background: linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(34, 211, 238, 0.2));
        }

        .rates-card {
          background: linear-gradient(135deg, rgba(34, 197, 94, 0.2), rgba(16, 185, 129, 0.2));
        }

        .holidays-card {
          background: linear-gradient(135deg, rgba(251, 146, 60, 0.2), rgba(245, 158, 11, 0.2));
        }

        .actions-card {
          background: linear-gradient(135deg, rgba(168, 85, 247, 0.2), rgba(236, 72, 153, 0.2));
        }

        .warnings-card {
          background: linear-gradient(135deg, rgba(239, 68, 68, 0.2), rgba(217, 70, 39, 0.2));
        }

        .action-button {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 16px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          color: inherit;
          cursor: pointer;
          text-decoration: none;
          transition: all 0.3s ease;
          font-size: 12px;
          font-weight: 500;
        }

        .action-button:hover {
          background: rgba(255, 255, 255, 0.1);
          border-color: rgba(255, 255, 255, 0.2);
          transform: translateY(-2px);
        }

        .action-icon {
          font-size: 24px;
        }
      `}</style>

      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "30px",
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: "32px", marginBottom: "8px" }}>
            🌅 Dzień dobry!
          </h1>
          <p style={{ margin: 0, color: "#a8a8b8" }}>
            Dziś: {data.currentDay}, {new Date().toLocaleDateString("pl-PL")}
          </p>
        </div>
        <button
          onClick={fetchData}
          style={{
            background: "rgba(255, 255, 255, 0.1)",
            border: "1px solid rgba(255, 255, 255, 0.2)",
            color: "inherit",
            padding: "8px 16px",
            borderRadius: "8px",
            cursor: "pointer",
            fontSize: "16px",
            transition: "all 0.3s ease",
          }}
          onMouseEnter={(e) => {
            (e.target as HTMLElement).style.background =
              "rgba(255, 255, 255, 0.15)";
          }}
          onMouseLeave={(e) => {
            (e.target as HTMLElement).style.background =
              "rgba(255, 255, 255, 0.1)";
          }}
        >
          🔄 Odśwież
        </button>
      </div>

      {/* Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          gap: "20px",
          marginBottom: "20px",
        }}
      >
        {/* Weather Card */}
        <div className="dashboard-card weather-card">
          <h2 style={{ margin: "0 0 12px 0", fontSize: "18px" }}>
            🌤️ POGODA
          </h2>
          {data.loading ? (
            <LoadingSkeleton />
          ) : data.weather ? (
            <div>
              <p style={{ margin: "8px 0", fontSize: "14px", color: "#a8a8b8" }}>
                {data.weather.city}
              </p>
              <p style={{ margin: "8px 0", fontSize: "24px", fontWeight: "bold" }}>
                {weatherEmoji} {Math.round(data.weather.temperature)}°C
              </p>
              <p style={{ margin: "4px 0", fontSize: "12px", color: "#a8a8b8" }}>
                {data.weather.description}
              </p>
              <p style={{ margin: "4px 0", fontSize: "12px", color: "#a8a8b8" }}>
                Wiatr: {Math.round(data.weather.windSpeed)} km/h
              </p>
              <p style={{ margin: "4px 0", fontSize: "12px", color: "#a8a8b8" }}>
                Wilgotność: {data.weather.humidity}%
              </p>
              <p
                style={{
                  margin: "12px 0 0 0",
                  fontSize: "10px",
                  color: "#6a6a8a",
                }}
              >
                Aktualizacja: {data.lastUpdated}
              </p>
            </div>
          ) : null}
        </div>

        {/* Rates Card */}
        <div className="dashboard-card rates-card">
          <h2 style={{ margin: "0 0 12px 0", fontSize: "18px" }}>
            💶 KURSY WALUT
          </h2>
          {data.loading ? (
            <LoadingSkeleton />
          ) : (
            <div>
              {data.rates.map((rate) => (
                <div key={rate.currency} style={{ marginBottom: "16px" }}>
                  <p
                    style={{
                      margin: "0",
                      fontSize: "14px",
                      fontWeight: "bold",
                    }}
                  >
                    {rate.currency}: {rate.rate.toFixed(4)} PLN
                  </p>
                </div>
              ))}
              <p
                style={{
                  margin: "12px 0 0 0",
                  fontSize: "10px",
                  color: "#6a6a8a",
                }}
              >
                Kurs z: {data.rates[0]?.date} (NBP)
              </p>
            </div>
          )}
        </div>

        {/* Holidays Card */}
        <div className="dashboard-card holidays-card">
          <h2 style={{ margin: "0 0 12px 0", fontSize: "18px" }}>
            📅 NADCHODZĄCE ŚWIĘTA
          </h2>
          {data.loading ? (
            <LoadingSkeleton />
          ) : data.holidays.length > 0 ? (
            <div style={{ maxHeight: "300px", overflowY: "auto" }}>
              {data.holidays.map((holiday) => (
                <div key={holiday.date} style={{ marginBottom: "12px" }}>
                  <p style={{ margin: "0", fontSize: "12px", color: "#a8a8b8" }}>
                    {new Date(holiday.date).toLocaleDateString("pl-PL", {
                      day: "numeric",
                      month: "short",
                    })}
                  </p>
                  <p style={{ margin: "4px 0 0 0", fontSize: "14px" }}>
                    {holiday.localName}
                  </p>
                </div>
              ))}
              <p
                style={{
                  margin: "12px 0 0 0",
                  fontSize: "10px",
                  color: "#6a6a8a",
                }}
              >
                Razem: {data.holidays.length} świąt w ciągu 90 dni
              </p>
            </div>
          ) : (
            <p style={{ color: "#a8a8b8" }}>Brak nadchodzących świąt</p>
          )}
        </div>

        {/* Travel Warnings Card */}
        <div className="dashboard-card warnings-card">
          <h2 style={{ margin: "0 0 12px 0", fontSize: "18px" }}>
            ⚠️ OSTRZEŻENIA PODRÓŻNE
          </h2>
          {data.loading ? (
            <LoadingSkeleton />
          ) : data.travelWarnings.length > 0 ? (
            <div style={{ maxHeight: "300px", overflowY: "auto" }}>
              {data.travelWarnings.map((warning) => {
                const riskLevelMap: Record<number | string, { emoji: string; color: string }> = {
                  "1": { emoji: "🟢", color: "#10b981" },
                  "2": { emoji: "🟡", color: "#f59e0b" },
                  "3": { emoji: "🔴", color: "#ef4444" },
                  "4": { emoji: "⛔", color: "#dc2626" },
                };
                const level = warning.riskLevel;
                const meta = riskLevelMap[level] || { emoji: "❓", color: "#a8a8b8" };

                return (
                  <div key={warning.countryCode} style={{ marginBottom: "12px" }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <span style={{ fontSize: "14px", fontWeight: "bold" }}>
                        {warning.country}
                      </span>
                      <span style={{ fontSize: "20px" }}>{meta.emoji}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p style={{ color: "#a8a8b8" }}>Brak danych o ostrzeżeniach</p>
          )}
        </div>

        {/* Quick Actions Card */}
        <div className="dashboard-card actions-card">
          <h2 style={{ margin: "0 0 12px 0", fontSize: "18px" }}>
            🤖 SZYBKIE AKCJE
          </h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap: "12px",
            }}
          >
            {quickActions.map((action) => (
              <Link
                key={action.href}
                href={action.href}
                className="action-button"
              >
                <span className="action-icon">{action.icon}</span>
                <span>{action.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
