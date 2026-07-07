import { Currency } from "@/src/currency";

// Format a number using a Currency descriptor.
export function formatMoney(
  amount: number,
  currency: Currency,
  opts: { compact?: boolean; showSign?: boolean } = {},
): string {
  const { compact = false, showSign = false } = opts;
  const abs = Math.abs(amount);

  let body: string;
  if (compact && currency.code === "INR") {
    if (abs >= 10000000) body = `${(abs / 10000000).toFixed(abs >= 100000000 ? 1 : 2)}Cr`;
    else if (abs >= 100000) body = `${(abs / 100000).toFixed(abs >= 1000000 ? 1 : 2)}L`;
    else if (abs >= 1000) body = `${(abs / 1000).toFixed(abs >= 10000 ? 1 : 2)}K`;
    else body = new Intl.NumberFormat(currency.locale, { maximumFractionDigits: 0 }).format(Math.round(abs));
  } else if (compact) {
    if (abs >= 1_000_000_000) body = `${(abs / 1_000_000_000).toFixed(abs >= 10_000_000_000 ? 1 : 2)}B`;
    else if (abs >= 1_000_000) body = `${(abs / 1_000_000).toFixed(abs >= 10_000_000 ? 1 : 2)}M`;
    else if (abs >= 1000) body = `${(abs / 1000).toFixed(abs >= 10000 ? 1 : 2)}K`;
    else body = new Intl.NumberFormat(currency.locale, { maximumFractionDigits: 0 }).format(Math.round(abs));
  } else {
    try {
      body = new Intl.NumberFormat(currency.locale, { maximumFractionDigits: 0 }).format(Math.round(abs));
    } catch {
      body = String(Math.round(abs));
    }
  }

  const sign = showSign ? (amount > 0 ? "+" : amount < 0 ? "-" : "") : amount < 0 ? "-" : "";
  const sep = currency.symbol.length > 1 ? " " : "";
  return `${sign}${currency.symbol}${sep}${body}`;
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
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
  return d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
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
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}
