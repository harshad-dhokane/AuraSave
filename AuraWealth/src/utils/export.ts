import { Platform } from "react-native";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import { Transaction, Category } from "@/src/store";
import { Currency } from "@/src/currency";

function csvEscape(v: string | number | undefined): string {
  const s = v == null ? "" : String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export interface ExportRange {
  from: Date;
  to: Date; // inclusive
  label: string;
}

export function filterByRange(txs: Transaction[], range: ExportRange): Transaction[] {
  const fromMs = new Date(range.from.getFullYear(), range.from.getMonth(), range.from.getDate()).getTime();
  const toMs = new Date(range.to.getFullYear(), range.to.getMonth(), range.to.getDate(), 23, 59, 59, 999).getTime();
  return txs.filter((t) => {
    const ts = new Date(t.date).getTime();
    return ts >= fromMs && ts <= toMs;
  });
}

export function buildCsv(txs: Transaction[], cats: Category[], currency: Currency): string {
  const catMap = new Map(cats.map((c) => [c.id, c]));
  const header = [
    "Date",
    "Type",
    "Category",
    "Amount",
    `Currency`,
    "Note",
    "Signed Amount",
  ];
  const rows: string[] = [header.map(csvEscape).join(",")];

  for (const t of txs) {
    const c = catMap.get(t.categoryId);
    const dateStr = new Date(t.date).toISOString().slice(0, 10);
    const signed = t.type === "income" ? t.amount : -t.amount;
    rows.push(
      [
        csvEscape(dateStr),
        csvEscape(t.type),
        csvEscape(c?.name || "Uncategorized"),
        csvEscape(t.amount),
        csvEscape(currency.code),
        csvEscape(t.note || ""),
        csvEscape(signed),
      ].join(","),
    );
  }

  // Totals row
  const totals = txs.reduce(
    (acc, t) => {
      if (t.type === "income") acc.income += t.amount;
      else if (t.type === "expense") acc.expense += t.amount;
      else acc.invest += t.amount;
      return acc;
    },
    { income: 0, expense: 0, invest: 0 },
  );
  rows.push("");
  rows.push(["Totals", "", "", "", "", "", ""].map(csvEscape).join(","));
  rows.push(["Income", "", "", totals.income, currency.code, "", totals.income].map(csvEscape).join(","));
  rows.push(["Expense", "", "", totals.expense, currency.code, "", -totals.expense].map(csvEscape).join(","));
  rows.push(["Investment", "", "", totals.invest, currency.code, "", -totals.invest].map(csvEscape).join(","));
  rows.push(
    [
      "Net",
      "",
      "",
      totals.income - totals.expense - totals.invest,
      currency.code,
      "",
      totals.income - totals.expense - totals.invest,
    ]
      .map(csvEscape)
      .join(","),
  );

  return rows.join("\n");
}

export async function exportCsv(
  csv: string,
  filename: string,
): Promise<{ ok: boolean; message: string }> {
  try {
    if (Platform.OS === "web") {
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      return { ok: true, message: "Downloaded" };
    }

    // Native: write to a temp file, then invoke the share sheet.
    const dir =
      (FileSystem as any).cacheDirectory ||
      (FileSystem as any).documentDirectory ||
      "";
    const fileUri = `${dir}${filename}`;
    if ((FileSystem as any).writeAsStringAsync) {
      await (FileSystem as any).writeAsStringAsync(fileUri, csv, {
        encoding: (FileSystem as any).EncodingType?.UTF8 || "utf8",
      });
    } else if ((FileSystem as any).File) {
      // Newer FS API (Expo SDK 54+ File class)
      const F = (FileSystem as any).File;
      const f = new F(fileUri);
      await f.write(csv);
    }

    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(fileUri, {
        mimeType: "text/csv",
        dialogTitle: "Export transactions",
        UTI: "public.comma-separated-values-text",
      });
      return { ok: true, message: "Shared" };
    }
    return { ok: true, message: `Saved to ${fileUri}` };
  } catch (e: any) {
    return { ok: false, message: e?.message || "Failed to export" };
  }
}
