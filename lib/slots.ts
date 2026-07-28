export const TIMEZONE = "Europe/Warsaw";
export const WORKING_DAYS = [1, 2, 3, 4, 5]; // Mon-Fri
export const BUSINESS_START_HOUR = 9;
export const BUSINESS_END_HOUR = 17; // last slot starts at 16:00
export const SLOT_MINUTES = 60;

export function isValidDateString(dateStr: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(dateStr);
}

export function generateSlotTimes(): string[] {
  const times: string[] = [];
  for (let hour = BUSINESS_START_HOUR; hour < BUSINESS_END_HOUR; hour += SLOT_MINUTES / 60) {
    times.push(`${String(hour).padStart(2, "0")}:00`);
  }
  return times;
}

export function dateIsWorkingDay(dateStr: string): boolean {
  const [year, month, day] = dateStr.split("-").map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return WORKING_DAYS.includes(weekday);
}

/** Combines a YYYY-MM-DD date and HH:mm time (interpreted in Europe/Warsaw) into a UTC ISO timestamp. */
export function toWarsawTimestamp(dateStr: string, time: string): string {
  // Europe/Warsaw is UTC+1 (winter) / UTC+2 (summer). We resolve the offset by
  // formatting a UTC guess through the timezone and comparing, avoiding a hardcoded offset.
  const [hour, minute] = time.split(":").map(Number);
  const naiveUtc = new Date(`${dateStr}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00Z`);

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const parts = formatter.formatToParts(naiveUtc).reduce<Record<string, string>>((acc, part) => {
    acc[part.type] = part.value;
    return acc;
  }, {});
  const shownAsWarsaw = new Date(
    Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour === "24" ? "0" : parts.hour),
      Number(parts.minute),
    ),
  );
  const offsetMs = naiveUtc.getTime() - shownAsWarsaw.getTime();
  return new Date(naiveUtc.getTime() + offsetMs).toISOString();
}
