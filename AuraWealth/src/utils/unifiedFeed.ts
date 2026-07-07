import { Transaction, GoalContribution, Loan, Goal, Category } from "@/src/store";
import { colors } from "@/src/theme";

export interface UnifiedRecord {
  id: string;
  type: "expense" | "income" | "investment" | "saved" | "lent" | "borrowed";
  amount: number;
  date: string;
  title: string;
  subtitle: string;
  icon: string;
  color: string;
  originalData: Transaction | GoalContribution | Loan;
}

export function buildUnifiedFeed(
  transactions: Transaction[],
  contributions: GoalContribution[],
  loans: Loan[],
  categories: Category[],
  goals: Goal[]
): UnifiedRecord[] {
  const catMap = new Map(categories.map((c) => [c.id, c]));
  const goalMap = new Map(goals.map((g) => [g.id, g]));

  const records: UnifiedRecord[] = [];

  // 1. Map Transactions
  for (const t of transactions) {
    const c = catMap.get(t.categoryId);
    records.push({
      id: t.id,
      type: t.type,
      amount: t.amount,
      date: t.date,
      title: c?.name || "Unknown",
      subtitle: t.note || "Transaction",
      icon: c?.icon || "ellipsis-horizontal",
      color: c?.color || colors.muted,
      originalData: t,
    });
  }

  // 2. Map Goal Contributions
  for (const gc of contributions) {
    const g = goalMap.get(gc.goalId);
    if (!g) continue; // Skip if goal is deleted
    records.push({
      id: gc.id,
      type: "saved",
      amount: gc.amount,
      date: gc.createdAt,
      title: "Goal",
      subtitle: g.title,
      icon: "flag",
      color: colors.brand,
      originalData: gc,
    });
  }

  // 3. Map Loans
  for (const l of loans) {
    records.push({
      id: l.id,
      type: l.type as "lent" | "borrowed",
      amount: l.amount,
      date: l.date,
      title: "Lending",
      subtitle: l.person,
      icon: l.type === "lent" ? "arrow-up" : "arrow-down",
      color: l.type === "lent" ? colors.info : colors.error,
      originalData: l,
    });
  }

  // Sort strictly by Date descending
  return records.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}
