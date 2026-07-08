import { supabase } from "@/src/lib/supabase";
import { colors } from "@/src/theme";

// ─── Types ──────────────────────────────────────────────────────────────────
export type TxType = "expense" | "income" | "investment";

export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  type: TxType;
}

export interface Transaction {
  id: string;
  type: TxType;
  amount: number;
  categoryId: string;
  note?: string;
  date: string;
  createdAt: string;
}

export interface Budget {
  id: string;
  categoryId: string;
  limit: number;
  month: string;
  kind?: "fixed" | "flexible";
  rolloverEnabled?: boolean;
  alertPercent?: number;
  recurringDay?: number;
  notes?: string;
}

export interface Goal {
  id: string;
  title: string;
  target: number;
  saved: number;
  deadline?: string;
  period?: string; // e.g. '3 months', '6 months', '1 year'
  status: "pending" | "completed";
  priority?: "low" | "medium" | "high";
  isPaused?: boolean;
  isArchived?: boolean;
  autoContributionAmount?: number;
  autoContributionDay?: number;
  createdAt: string;
}

// ─── Predefined Categories ──────────────────────────────────────────────────
export const DEFAULT_CATEGORIES: Category[] = [
  // Expense
  { id: "cat-food", name: "Food & Dining", icon: "restaurant", color: colors.cat.ochre, type: "expense" },
  { id: "cat-transport", name: "Transport", icon: "car", color: colors.cat.slate, type: "expense" },
  { id: "cat-shopping", name: "Shopping", icon: "bag-handle", color: colors.cat.plum, type: "expense" },
  { id: "cat-bills", name: "Bills", icon: "receipt", color: colors.cat.terracotta, type: "expense" },
  // Income
  { id: "cat-salary", name: "Salary", icon: "cash", color: colors.cat.forest, type: "income" },
  { id: "cat-business", name: "Business", icon: "briefcase", color: colors.cat.olive, type: "income" },
  { id: "cat-freelance", name: "Freelance", icon: "laptop", color: colors.cat.sage, type: "income" },
  { id: "cat-other-inc", name: "Other", icon: "ellipsis-horizontal", color: colors.cat.slate, type: "income" },
  // Investment
  { id: "cat-stocks", name: "Stocks", icon: "trending-up", color: colors.cat.forest, type: "investment" },
  { id: "cat-mf", name: "Mutual Funds", icon: "pie-chart", color: colors.cat.sage, type: "investment" },
  { id: "cat-fd", name: "Fixed Deposit", icon: "shield-checkmark", color: colors.cat.sand, type: "investment" },
  { id: "cat-crypto", name: "Crypto", icon: "logo-bitcoin", color: colors.cat.ochre, type: "investment" },
];

// ─── Helpers ────────────────────────────────────────────────────────────────
export function makeId(prefix = "id"): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function isMissingDbShape(error: any): boolean {
  const message = `${error?.message || ""} ${error?.details || ""}`.toLowerCase();
  return (
    error?.code === "42703" ||
    error?.code === "PGRST204" ||
    message.includes("schema cache") ||
    (message.includes("column") && message.includes("does not exist"))
  );
}


// ── Cache ──────────────────────────────────────────────────────────────────
const _qCache = new Map<string, { data: any; ts: number; promise?: Promise<any> }>();

export function clearCache() {
  _qCache.clear();
}

async function withCache<T>(key: string, fetcher: () => Promise<T>, ttl = 10000): Promise<T> {
  const c = _qCache.get(key);
  if (c && Date.now() - c.ts < ttl) return c.data;
  if (c?.promise) return c.promise;
  const p = fetcher().then(d => {
    _qCache.set(key, { data: d, ts: Date.now() });
    return d;
  }).catch(e => {
    _qCache.delete(key);
    throw e;
  });
  _qCache.set(key, { ...c, promise: p } as any);
  return p;
}

// ── Cached User ID ──────────────────────────────────────────────────────────
// Avoids redundant auth round-trips on every single DB call
let _cachedUserId: string | null = null;

async function getUserId(): Promise<string> {
  if (_cachedUserId) return _cachedUserId;
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Not authenticated");
  _cachedUserId = data.user.id;
  return _cachedUserId;
}

// Clear cache on auth state change (sign-out / sign-in)
supabase.auth.onAuthStateChange((_event, session) => {
  _cachedUserId = session?.user?.id ?? null;
});

// ─── Transactions ───────────────────────────────────────────────────────────
export async function getTransactions(): Promise<Transaction[]> {
  return withCache('tx', async () => {
  const userId = await getUserId();
    const { data, error } = await supabase
      .from("transactions")
      .select("id, type, amount, category_id, note, date, created_at")
      .eq("user_id", userId)
      .order("date", { ascending: false });
    if (error) throw error;
    return (data || []).map((r: any) => ({
      id: r.id,
      type: r.type,
      amount: Number(r.amount),
      categoryId: r.category_id,
      note: r.note || undefined,
      date: r.date,
      createdAt: r.created_at,
    }));
  });
}

export async function addTransaction(tx: Omit<Transaction, "id" | "createdAt">): Promise<Transaction> {
  const userId = await getUserId();
  const id = makeId("tx");
  const { error } = await supabase.from("transactions").insert({
    id,
    user_id: userId,
    type: tx.type,
    amount: tx.amount,
    category_id: tx.categoryId,
    note: tx.note || null,
    date: tx.date,
  });
  if (error) throw error;
  clearCache();
  return { ...tx, id, createdAt: new Date().toISOString() };
}

export async function deleteTransaction(id: string): Promise<void> {
  const { error } = await supabase.from("transactions").delete().eq("id", id);
  if (error) throw error;
  clearCache();
}

// ─── Categories ─────────────────────────────────────────────────────────────
export async function getCategories(): Promise<Category[]> {
  return withCache('cat', async () => {
  const userId = await getUserId();
    const { data, error } = await supabase
      .from("categories")
      .select("id, name, icon, color, type")
      .eq("user_id", userId);
    if (error) throw error;
    if (!data || data.length === 0) {
      // Seed default categories for this user
      await seedCategories(userId);
      return DEFAULT_CATEGORIES;
    }
    return data.map((r: any) => ({
      id: r.id,
      name: r.name,
      icon: r.icon,
      color: r.color,
      type: r.type,
    }));
  });
}

async function seedCategories(userId: string): Promise<void> {
  const rows = DEFAULT_CATEGORIES.map((c) => ({
    id: c.id,
    user_id: userId,
    name: c.name,
    icon: c.icon,
    color: c.color,
    type: c.type,
    is_default: true,
  }));
  const { error } = await supabase.from("categories").insert(rows);
  if (error) console.error("Seed categories error:", error);
}

export async function addCategory(cat: Omit<Category, "id">): Promise<Category> {
  const userId = await getUserId();
  const id = makeId("cat");
  const { error } = await supabase.from("categories").insert({
    id,
    user_id: userId,
    name: cat.name,
    icon: cat.icon,
    color: cat.color,
    type: cat.type,
    is_default: false,
  });
  if (error) throw error;
  clearCache();
  return { ...cat, id };
}

// ─── Budgets ────────────────────────────────────────────────────────────────
export async function getBudgets(): Promise<Budget[]> {
  return withCache('bg', async () => {
  const userId = await getUserId();
    const baseQuery = () => supabase.from("budgets").select("id, category_id, limit, month").eq("user_id", userId);
    const extendedQuery = () => supabase
      .from("budgets")
      .select("id, category_id, limit, month, kind, rollover_enabled, alert_percent, recurring_day, notes")
      .eq("user_id", userId);
  
    let result = await extendedQuery();
    let data: any[] | null = result.data as any[] | null;
    let error: any = result.error;
    if (error && isMissingDbShape(error)) {
      const fallback = await baseQuery();
      data = fallback.data as any[] | null;
      error = fallback.error;
    }
    if (error) throw error;
    return (data || []).map((r: any) => ({
      id: r.id,
      categoryId: r.category_id,
      limit: Number(r.limit),
      month: r.month,
      kind: r.kind || "flexible",
      rolloverEnabled: r.rollover_enabled === true,
      alertPercent: Number(r.alert_percent || 80),
      recurringDay: r.recurring_day ? Number(r.recurring_day) : undefined,
      notes: r.notes || undefined,
    }));
  });
}

export async function upsertBudget(b: Omit<Budget, "id"> & { id?: string }): Promise<Budget> {
  const userId = await getUserId();
  const updatePayload: any = { limit: b.limit };
  if (b.kind !== undefined) updatePayload.kind = b.kind;
  if (b.rolloverEnabled !== undefined) updatePayload.rollover_enabled = b.rolloverEnabled;
  if (b.alertPercent !== undefined) updatePayload.alert_percent = b.alertPercent;
  if (b.recurringDay !== undefined) updatePayload.recurring_day = b.recurringDay || null;
  if (b.notes !== undefined) updatePayload.notes = b.notes || null;

  // Check if budget already exists for this category+month
  const { data: existing } = await supabase
    .from("budgets")
    .select("id")
    .eq("user_id", userId)
    .eq("category_id", b.categoryId)
    .eq("month", b.month)
    .maybeSingle();

  if (existing) {
    let { error } = await supabase
      .from("budgets")
      .update(updatePayload)
      .eq("id", existing.id);
    if (error && isMissingDbShape(error)) {
      const fallback = await supabase
        .from("budgets")
        .update({ limit: b.limit })
        .eq("id", existing.id);
      error = fallback.error;
    }
    if (error) throw error;
    return {
      id: existing.id,
      categoryId: b.categoryId,
      limit: b.limit,
      month: b.month,
      kind: b.kind || "flexible",
      rolloverEnabled: b.rolloverEnabled === true,
      alertPercent: b.alertPercent || 80,
      recurringDay: b.recurringDay,
      notes: b.notes,
    };
  } else {
    const id = makeId("bg");
    const insertPayload: any = {
      id,
      user_id: userId,
      category_id: b.categoryId,
      limit: b.limit,
      month: b.month,
      kind: b.kind || "flexible",
      rollover_enabled: b.rolloverEnabled === true,
      alert_percent: b.alertPercent || 80,
      recurring_day: b.recurringDay || null,
      notes: b.notes || null,
    };
    let { error } = await supabase.from("budgets").insert(insertPayload);
    if (error && isMissingDbShape(error)) {
      const fallback = await supabase.from("budgets").insert({
        id,
        user_id: userId,
        category_id: b.categoryId,
        limit: b.limit,
        month: b.month,
      });
      error = fallback.error;
    }
    if (error) throw error;
  clearCache();
    return {
      id,
      categoryId: b.categoryId,
      limit: b.limit,
      month: b.month,
      kind: b.kind || "flexible",
      rolloverEnabled: b.rolloverEnabled === true,
      alertPercent: b.alertPercent || 80,
      recurringDay: b.recurringDay,
      notes: b.notes,
    };
  }
}

export async function deleteBudget(id: string): Promise<void> {
  const { error } = await supabase.from("budgets").delete().eq("id", id);
  if (error) throw error;
  clearCache();
}

// ─── Goals ──────────────────────────────────────────────────────────────────
export async function getGoals(): Promise<Goal[]> {
  return withCache('gl', async () => {
  const userId = await getUserId();
    const baseQuery = () => supabase
      .from("goals")
      .select("id, title, target, saved, deadline, period, status, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    const extendedQuery = () => supabase
      .from("goals")
      .select("id, title, target, saved, deadline, period, status, priority, is_paused, is_archived, auto_contribution_amount, auto_contribution_day, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
  
    let result = await extendedQuery();
    let data: any[] | null = result.data as any[] | null;
    let error: any = result.error;
    if (error && isMissingDbShape(error)) {
      const fallback = await baseQuery();
      data = fallback.data as any[] | null;
      error = fallback.error;
    }
    if (error) throw error;
    return (data || []).map((r: any) => ({
      id: r.id,
      title: r.title,
      target: Number(r.target),
      saved: Number(r.saved),
      deadline: r.deadline || undefined,
      period: r.period || undefined,
      status: r.status || "pending",
      priority: r.priority || "medium",
      isPaused: r.is_paused === true,
      isArchived: r.is_archived === true,
      autoContributionAmount: r.auto_contribution_amount ? Number(r.auto_contribution_amount) : undefined,
      autoContributionDay: r.auto_contribution_day ? Number(r.auto_contribution_day) : undefined,
      createdAt: r.created_at,
    }));
  });
}

export async function addGoal(g: Omit<Goal, "id" | "createdAt">): Promise<Goal> {
  const userId = await getUserId();
  const id = makeId("gl");
  const insertPayload: any = {
    id,
    user_id: userId,
    title: g.title,
    target: g.target,
    saved: g.saved,
    deadline: g.deadline || null,
    period: g.period || null,
    status: g.status || "pending",
    priority: g.priority || "medium",
    is_paused: g.isPaused === true,
    is_archived: g.isArchived === true,
    auto_contribution_amount: g.autoContributionAmount || null,
    auto_contribution_day: g.autoContributionDay || null,
  };
  let { error } = await supabase.from("goals").insert(insertPayload);
  if (error && isMissingDbShape(error)) {
    const fallback = await supabase.from("goals").insert({
      id,
      user_id: userId,
      title: g.title,
      target: g.target,
      saved: g.saved,
      deadline: g.deadline || null,
      period: g.period || null,
      status: g.status || "pending",
    });
    error = fallback.error;
  }
  if (error) throw error;
  clearCache();
  return { ...g, id, status: g.status || "pending", priority: g.priority || "medium", createdAt: new Date().toISOString() };
}

export async function updateGoal(id: string, patch: Partial<Goal>): Promise<void> {
  const updates: any = {};
  if (patch.title !== undefined) updates.title = patch.title;
  if (patch.target !== undefined) updates.target = patch.target;
  if (patch.saved !== undefined) updates.saved = patch.saved;
  if (patch.deadline !== undefined) updates.deadline = patch.deadline;
  if (patch.period !== undefined) updates.period = patch.period;
  if (patch.status !== undefined) updates.status = patch.status;
  if (patch.priority !== undefined) updates.priority = patch.priority;
  if (patch.isPaused !== undefined) updates.is_paused = patch.isPaused;
  if (patch.isArchived !== undefined) updates.is_archived = patch.isArchived;
  if (patch.autoContributionAmount !== undefined) updates.auto_contribution_amount = patch.autoContributionAmount || null;
  if (patch.autoContributionDay !== undefined) updates.auto_contribution_day = patch.autoContributionDay || null;
  let { error } = await supabase.from("goals").update(updates).eq("id", id);
  if (error && isMissingDbShape(error)) {
    delete updates.priority;
    delete updates.is_paused;
    delete updates.is_archived;
    delete updates.auto_contribution_amount;
    delete updates.auto_contribution_day;
    const fallback = await supabase.from("goals").update(updates).eq("id", id);
    error = fallback.error;
  }
  if (error) throw error;
  clearCache();
}

export async function deleteGoal(id: string): Promise<void> {
  const { error } = await supabase.from("goals").delete().eq("id", id);
  if (error) throw error;
  clearCache();
}

// ─── Goal Contributions ─────────────────────────────────────────────────────
export interface GoalContribution {
  id: string;
  goalId: string;
  amount: number;
  createdAt: string;
}

export async function getGoalContributions(goalId?: string): Promise<GoalContribution[]> {
  return withCache('gc', async () => {
  let query = supabase
      .from("goal_contributions")
      .select("id, goal_id, amount, created_at")
      .order("created_at", { ascending: false });
      
    if (goalId) {
      query = query.eq("goal_id", goalId);
    }
  
    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map((r: any) => ({
      id: r.id,
      goalId: r.goal_id,
      amount: Number(r.amount),
      createdAt: r.created_at,
    }));
  });
}

export async function addGoalContribution(goalId: string, amount: number): Promise<GoalContribution> {
  const userId = await getUserId();
  const id = makeId("gc");
  const { error } = await supabase.from("goal_contributions").insert({
    id,
    goal_id: goalId,
    user_id: userId,
    amount,
  });
  if (error) throw error;
  clearCache();
  return { id, goalId, amount, createdAt: new Date().toISOString() };
}

// ─── Loans ──────────────────────────────────────────────────────────────────
export interface Loan {
  id: string;
  type: "lent" | "borrowed";
  person: string;
  amount: number;
  paidAmount: number;
  date: string;
  dueDate?: string;
  status: "active" | "settled";
  repaymentExpected: boolean;
  notes?: string;
  interestRate?: number;
  proofNote?: string;
  groupName?: string;
  settledAt?: string;
  reminderAt?: string;
  createdAt: string;
}

export interface LoanPayment {
  id: string;
  loanId: string;
  amount: number;
  date: string;
  note?: string;
  createdAt: string;
}

function dedupeLoans(loans: Loan[]): Loan[] {
  const seen = new Map<string, Loan>();

  for (const loan of loans) {
    const createdTime = new Date(loan.createdAt).getTime();
    const createdBucket = Number.isFinite(createdTime) ? Math.floor(createdTime / 5000) : 0;
    const signature = [
      loan.type,
      loan.person.trim().toLowerCase(),
      loan.amount,
      loan.date,
      loan.dueDate || "",
      loan.status,
      loan.paidAmount,
      loan.repaymentExpected ? "repay" : "gift",
      loan.notes || "",
      loan.interestRate || 0,
      loan.proofNote || "",
      loan.groupName || "",
      createdBucket,
    ].join("|");

    if (!seen.has(signature)) {
      seen.set(signature, loan);
    }
  }

  return Array.from(seen.values());
}

export async function getLoans(): Promise<Loan[]> {
  return withCache('ln', async () => {
  const userId = await getUserId();
    const baseQuery = () => supabase
      .from("loans")
      .select("id, type, person, amount, paid_amount, date, due_date, status, repayment_expected, notes, created_at")
      .eq("user_id", userId)
      .order("date", { ascending: false });
    const extendedQuery = () => supabase
      .from("loans")
      .select("id, type, person, amount, paid_amount, date, due_date, status, repayment_expected, notes, interest_rate, proof_note, group_name, settled_at, reminder_at, created_at")
      .eq("user_id", userId)
      .order("date", { ascending: false });
  
    let result = await extendedQuery();
    let data: any[] | null = result.data as any[] | null;
    let error: any = result.error;
    if (error && isMissingDbShape(error)) {
      const fallback = await baseQuery();
      data = fallback.data as any[] | null;
      error = fallback.error;
    }
    if (error) throw error;
    const loans = (data || []).map((r: any) => ({
      id: r.id,
      type: r.type,
      person: r.person,
      amount: Number(r.amount),
      paidAmount: Number(r.paid_amount),
      date: r.date,
      dueDate: r.due_date || undefined,
      status: r.status,
      repaymentExpected: r.repayment_expected !== false,
      notes: r.notes || undefined,
      interestRate: r.interest_rate ? Number(r.interest_rate) : undefined,
      proofNote: r.proof_note || undefined,
      groupName: r.group_name || undefined,
      settledAt: r.settled_at || undefined,
      reminderAt: r.reminder_at || undefined,
      createdAt: r.created_at,
    }));
    return dedupeLoans(loans);
  });
}

export async function addLoan(l: Omit<Loan, "id" | "createdAt" | "paidAmount" | "status">): Promise<Loan> {
  const userId = await getUserId();
  const id = makeId("ln");
  const insertPayload: any = {
    id,
    user_id: userId,
    type: l.type,
    person: l.person,
    amount: l.amount,
    paid_amount: l.repaymentExpected ? 0 : l.amount,
    date: l.date,
    due_date: l.dueDate || null,
    status: l.repaymentExpected ? "active" : "settled",
    repayment_expected: l.repaymentExpected,
    notes: l.notes || null,
    interest_rate: l.interestRate || null,
    proof_note: l.proofNote || null,
    group_name: l.groupName || null,
    settled_at: l.repaymentExpected ? null : new Date().toISOString(),
  };
  let { error } = await supabase.from("loans").insert(insertPayload);
  if (error && isMissingDbShape(error)) {
    const fallback = await supabase.from("loans").insert({
      id,
      user_id: userId,
      type: l.type,
      person: l.person,
      amount: l.amount,
      paid_amount: l.repaymentExpected ? 0 : l.amount,
      date: l.date,
      due_date: l.dueDate || null,
      status: l.repaymentExpected ? "active" : "settled",
      repayment_expected: l.repaymentExpected,
      notes: l.notes || null,
    });
    error = fallback.error;
  }
  if (error) throw error;
  clearCache();
  return { ...l, id, paidAmount: 0, status: l.repaymentExpected ? "active" : "settled", createdAt: new Date().toISOString() };
}

export async function updateLoan(id: string, patch: Partial<Loan>): Promise<void> {
  const updates: any = {};
  if (patch.type !== undefined) updates.type = patch.type;
  if (patch.person !== undefined) updates.person = patch.person;
  if (patch.amount !== undefined) updates.amount = patch.amount;
  if (patch.paidAmount !== undefined) updates.paid_amount = patch.paidAmount;
  if (patch.date !== undefined) updates.date = patch.date;
  if (patch.dueDate !== undefined) updates.due_date = patch.dueDate;
  if (patch.status !== undefined) updates.status = patch.status;
  if (patch.repaymentExpected !== undefined) updates.repayment_expected = patch.repaymentExpected;
  if (patch.notes !== undefined) updates.notes = patch.notes;
  if (patch.interestRate !== undefined) updates.interest_rate = patch.interestRate || null;
  if (patch.proofNote !== undefined) updates.proof_note = patch.proofNote || null;
  if (patch.groupName !== undefined) updates.group_name = patch.groupName || null;
  if (patch.settledAt !== undefined) updates.settled_at = patch.settledAt;
  if (patch.reminderAt !== undefined) updates.reminder_at = patch.reminderAt;
  
  let { error } = await supabase.from("loans").update(updates).eq("id", id);
  if (error && isMissingDbShape(error)) {
    delete updates.interest_rate;
    delete updates.proof_note;
    delete updates.group_name;
    delete updates.settled_at;
    delete updates.reminder_at;
    const fallback = await supabase.from("loans").update(updates).eq("id", id);
    error = fallback.error;
  }
  if (error) throw error;
  clearCache();
}

export async function deleteLoan(id: string): Promise<void> {
  const { error } = await supabase.from("loans").delete().eq("id", id);
  if (error) throw error;
  clearCache();
}

export async function getLoanPayments(loanId: string): Promise<LoanPayment[]> {
  return withCache('lp', async () => {
  const baseQuery = () => supabase
      .from("loan_payments")
      .select("id, loan_id, amount, date, created_at")
      .eq("loan_id", loanId)
      .order("date", { ascending: false });
    const extendedQuery = () => supabase
      .from("loan_payments")
      .select("id, loan_id, amount, date, note, created_at")
      .eq("loan_id", loanId)
      .order("date", { ascending: false });
  
    let result = await extendedQuery();
    let data: any[] | null = result.data as any[] | null;
    let error: any = result.error;
    if (error && isMissingDbShape(error)) {
      const fallback = await baseQuery();
      data = fallback.data as any[] | null;
      error = fallback.error;
    }
    if (error) throw error;
    return (data || []).map((r: any) => ({
      id: r.id,
      loanId: r.loan_id,
      amount: Number(r.amount),
      date: r.date,
      note: r.note || undefined,
      createdAt: r.created_at,
    }));
  });
}

export async function addLoanPayment(loanId: string, amount: number, date: string, note?: string): Promise<LoanPayment> {
  const userId = await getUserId();
  const id = makeId("lp");
  let { error } = await supabase.from("loan_payments").insert({
    id,
    loan_id: loanId,
    user_id: userId,
    amount,
    date,
    note: note || null,
  });
  if (error && isMissingDbShape(error)) {
    const fallback = await supabase.from("loan_payments").insert({
      id,
      loan_id: loanId,
      user_id: userId,
      amount,
      date,
    });
    error = fallback.error;
  }
  if (error) throw error;
  clearCache();
  return { id, loanId, amount, date, note, createdAt: new Date().toISOString() };
}

// ─── Profile ────────────────────────────────────────────────────────────────
export interface Profile {
  name: string;
}

export async function getProfile(): Promise<Profile> {
  return withCache('pf', async () => {
  try {
      const userId = await getUserId();
      const { data } = await supabase
        .from("profiles")
        .select("name")
        .eq("id", userId)
        .single();
      return { name: data?.name || "there" };
    } catch {
      return { name: "there" };
    }
  });
}

export async function setProfile(p: Profile): Promise<void> {
  try {
    const userId = await getUserId();
    const { error } = await supabase
      .from("profiles")
      .update({ name: p.name })
      .eq("id", userId);
    if (error) throw error;
  } catch (err) {
    console.error("setProfile error:", err);
  }
  clearCache();
}

// ─── Batch Loaders (parallel fetching for pages) ────────────────────────────
// These fire all queries in parallel using a single cached userId,
// drastically reducing page load time from sequential round-trips.

export interface HomeData {
  profile: Profile;
  transactions: Transaction[];
  categories: Category[];
  budgets: Budget[];
  goals: Goal[];
  loans: Loan[];
}

export async function loadHomeData(): Promise<HomeData> {
  // Prime the userId cache with a single auth call
  await getUserId();
  
  // Fire all queries in parallel
  const [profile, transactions, categories, budgets, goals, loans] = await Promise.all([
    getProfile(),
    getTransactions(),
    getCategories(),
    getBudgets(),
    getGoals(),
    getLoans(),
  ]);
  
  return { profile, transactions, categories, budgets, goals, loans };
}

export interface AnalyticsData {
  transactions: Transaction[];
  categories: Category[];
}

export async function loadAnalyticsData(): Promise<AnalyticsData> {
  await getUserId();
  const [transactions, categories] = await Promise.all([
    getTransactions(),
    getCategories(),
  ]);
  return { transactions, categories };
}

export interface BudgetPageData {
  budgets: Budget[];
  transactions: Transaction[];
  categories: Category[];
}

export async function loadBudgetData(): Promise<BudgetPageData> {
  await getUserId();
  const [budgets, transactions, categories] = await Promise.all([
    getBudgets(),
    getTransactions(),
    getCategories(),
  ]);
  return { budgets, transactions, categories };
}

// ─── Utility: clearAllData ──────────────────────────────────────────────────
export async function clearAllData(): Promise<void> {
  try {
    const userId = await getUserId();
    await Promise.all([
      supabase.from("goal_contributions").delete().eq("user_id", userId),
      supabase.from("loan_payments").delete().eq("user_id", userId),
    ]);
    await Promise.all([
      supabase.from("transactions").delete().eq("user_id", userId),
      supabase.from("budgets").delete().eq("user_id", userId),
      supabase.from("goals").delete().eq("user_id", userId),
      supabase.from("loans").delete().eq("user_id", userId),
      supabase.from("categories").delete().eq("user_id", userId),
    ]);
  } catch (err) {
    console.error("clearAllData error:", err);
  }
}

// ─── Seed sample data on first launch ───────────────────────────────────────
export async function seedIfNeeded(): Promise<void> {
  await getCategories(); // This handles initial seeding of default categories
}
