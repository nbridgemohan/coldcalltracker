const TZ = "America/Port_of_Spain";

export function formatWhen(value: string | Date | null) {
  if (!value) return "";
  const d = new Date(value);
  const now = new Date();
  const day = (x: Date) => x.toLocaleDateString("en-CA", { timeZone: TZ });
  const time = d.toLocaleTimeString("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit" });
  const diffDays = Math.round((Date.parse(day(d)) - Date.parse(day(now))) / 86_400_000);
  if (diffDays === 0) return `Today ${time}`;
  if (diffDays === -1) return `Yesterday ${time}`;
  if (diffDays === 1) return `Tomorrow ${time}`;
  return d.toLocaleString("en-US", { timeZone: TZ, month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

/** Value for <input type="datetime-local"> in Trinidad time. */
export function toLocalInput(value: string | Date | null) {
  if (!value) return "";
  const d = new Date(value);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}
