// INR currency formatting
export function formatINR(amount: number, opts: { compact?: boolean; showSign?: boolean } = {}): string {
  const { compact = false, showSign = false } = opts;
  const abs = Math.abs(amount);

  let body: string;
  if (compact && abs >= 10000000) {
    body = `${(abs / 10000000).toFixed(abs >= 100000000 ? 1 : 2)}Cr`;
  } else if (compact && abs >= 100000) {
    body = `${(abs / 100000).toFixed(abs >= 1000000 ? 1 : 2)}L`;
  } else if (compact && abs >= 1000) {
    body = `${(abs / 1000).toFixed(abs >= 10000 ? 1 : 2)}K`;
  } else {
    body = new Intl.NumberFormat("en-IN", {
      maximumFractionDigits: 0,
    }).format(Math.round(abs));
  }

  const sign = showSign ? (amount > 0 ? "+" : amount < 0 ? "-" : "") : amount < 0 ? "-" : "";
  return `${sign}₹${body}`;
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function formatDayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const same = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  if (same(d, today)) return "Today";
  if (same(d, yesterday)) return "Yesterday";
  return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
}

export function monthKey(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function currentMonthKey(): string {
  return monthKey(new Date());
}

export function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, m - 1, 1);
  return d.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}
