import { supabase } from "@/src/lib/supabase";
import { colors } from "@/src/theme";

// ─── Types ──────────────────────────────────────────────────────────────────
export type TxType = "expense" | "income" | "investment";

export interface Category {
  id: string;
  name: string;
  icon: string; // Ionicons name
  color: string;
  type: TxType;
}

export interface Transaction {
  id: string;
  type: TxType;
  amount: number;
  categoryId: string;
  note?: string;
  date: string; // ISO string
  createdAt: string;
}

export interface Budget {
  id: string;
  categoryId: string;
  limit: number;
  month: string; // YYYY-MM
}

export interface Goal {
  id: string;
  title: string;
  target: number;
  saved: number;
  deadline?: string; // ISO string
  createdAt: string;
}

// ─── Predefined Categories ──────────────────────────────────────────────────
export const DEFAULT_CATEGORIES: Category[] = [
  // Expense
  { id: "cat-food", name: "Food & Dining", icon: "restaurant", color: colors.cat.ochre, type: "expense" },
  { id: "cat-groceries", name: "Groceries", icon: "basket", color: colors.cat.olive, type: "expense" },
  { id: "cat-transport", name: "Transport", icon: "car", color: colors.cat.slate, type: "expense" },
  { id: "cat-shopping", name: "Shopping", icon: "bag-handle", color: colors.cat.plum, type: "expense" },
  { id: "cat-bills", name: "Bills & Utilities", icon: "receipt", color: colors.cat.terracotta, type: "expense" },
  { id: "cat-entertainment", name: "Entertainment", icon: "film", color: colors.cat.rust, type: "expense" },
  { id: "cat-health", name: "Health", icon: "medkit", color: colors.cat.moss, type: "expense" },
  { id: "cat-rent", name: "Rent", icon: "home", color: colors.cat.sand, type: "expense" },
  { id: "cat-travel", name: "Travel", icon: "airplane", color: colors.cat.sage, type: "expense" },
  { id: "cat-other-exp", name: "Other", icon: "ellipsis-horizontal", color: colors.cat.slate, type: "expense" },
  // Income
  { id: "cat-salary", name: "Salary", icon: "cash", color: colors.cat.forest, type: "income" },
  { id: "cat-freelance", name: "Freelance", icon: "laptop", color: colors.cat.sage, type: "income" },
  { id: "cat-business", name: "Business", icon: "briefcase", color: colors.cat.olive, type: "income" },
  { id: "cat-gift", name: "Gift", icon: "gift", color: colors.cat.plum, type: "income" },
  { id: "cat-other-inc", name: "Other Income", icon: "ellipsis-horizontal", color: colors.cat.slate, type: "income" },
  // Investment
  { id: "cat-stocks", name: "Stocks", icon: "trending-up", color: colors.cat.forest, type: "investment" },
  { id: "cat-mf", name: "Mutual Funds", icon: "pie-chart", color: colors.cat.sage, type: "investment" },
  { id: "cat-sip", name: "SIP", icon: "repeat", color: colors.cat.olive, type: "investment" },
  { id: "cat-fd", name: "Fixed Deposit", icon: "shield-checkmark", color: colors.cat.sand, type: "investment" },
  { id: "cat-crypto", name: "Crypto", icon: "logo-bitcoin", color: colors.cat.ochre, type: "investment" },
  { id: "cat-gold", name: "Gold", icon: "medal", color: colors.cat.sand, type: "investment" },
  { id: "cat-other-inv", name: "Other Investment", icon: "ellipsis-horizontal", color: colors.cat.slate, type: "investment" },
];

// ─── Helpers ────────────────────────────────────────────────────────────────
async function getUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  return data.user.id;
}

export function makeId(prefix = "id"): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// ─── Transactions ───────────────────────────────────────────────────────────
export async function getTransactions(): Promise<Transaction[]> {
  const userId = await getUserId();
  if (!userId) return [];
  const { data, error } = await supabase
    .from("transactions")
    .select("*")
    .eq("user_id", userId)
    .order("date", { ascending: false });

  if (error) {
    console.error("getTransactions error:", error);
    return [];
  }
  return (data || []).map(mapTransaction);
}

export async function addTransaction(tx: Omit<Transaction, "id" | "createdAt">): Promise<Transaction> {
  const userId = await getUserId();
  if (!userId) throw new Error("Not authenticated");
  const id = makeId("tx");
  const now = new Date().toISOString();
  const { error } = await supabase.from("transactions").insert({
    id,
    user_id: userId,
    type: tx.type,
    amount: tx.amount,
    category_id: tx.categoryId,
    note: tx.note || null,
    date: tx.date,
    created_at: now,
  });
  if (error) console.error("addTransaction error:", error);
  return { ...tx, id, createdAt: now };
}

export async function deleteTransaction(id: string): Promise<void> {
  const { error } = await supabase.from("transactions").delete().eq("id", id);
  if (error) console.error("deleteTransaction error:", error);
}

// ─── Categories ─────────────────────────────────────────────────────────────
export async function getCategories(): Promise<Category[]> {
  const userId = await getUserId();
  if (!userId) return DEFAULT_CATEGORIES;
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .eq("user_id", userId);

  if (error) {
    console.error("getCategories error:", error);
    return DEFAULT_CATEGORIES;
  }

  if (!data || data.length === 0) {
    // Seed default categories for this user
    await seedDefaultCategories(userId);
    return DEFAULT_CATEGORIES;
  }

  return data.map(mapCategory);
}

async function seedDefaultCategories(userId: string) {
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
  if (error) console.error("seedDefaultCategories error:", error);
}

export async function addCategory(cat: Omit<Category, "id">): Promise<Category> {
  const userId = await getUserId();
  if (!userId) throw new Error("Not authenticated");
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
  if (error) console.error("addCategory error:", error);
  return { ...cat, id };
}

// ─── Budgets ────────────────────────────────────────────────────────────────
export async function getBudgets(): Promise<Budget[]> {
  const userId = await getUserId();
  if (!userId) return [];
  const { data, error } = await supabase
    .from("budgets")
    .select("*")
    .eq("user_id", userId);

  if (error) {
    console.error("getBudgets error:", error);
    return [];
  }
  return (data || []).map(mapBudget);
}

export async function upsertBudget(b: Omit<Budget, "id"> & { id?: string }): Promise<Budget> {
  const userId = await getUserId();
  if (!userId) throw new Error("Not authenticated");

  // Check if budget exists for this category+month
  const { data: existing } = await supabase
    .from("budgets")
    .select("id")
    .eq("user_id", userId)
    .eq("category_id", b.categoryId)
    .eq("month", b.month)
    .limit(1)
    .single();

  if (existing) {
    // Update existing
    const { error } = await supabase
      .from("budgets")
      .update({ limit: b.limit })
      .eq("id", existing.id);
    if (error) console.error("upsertBudget update error:", error);
    return { id: existing.id, categoryId: b.categoryId, limit: b.limit, month: b.month };
  } else {
    // Insert new
    const id = makeId("bg");
    const { error } = await supabase.from("budgets").insert({
      id,
      user_id: userId,
      category_id: b.categoryId,
      limit: b.limit,
      month: b.month,
    });
    if (error) console.error("upsertBudget insert error:", error);
    return { id, categoryId: b.categoryId, limit: b.limit, month: b.month };
  }
}

export async function deleteBudget(id: string): Promise<void> {
  const { error } = await supabase.from("budgets").delete().eq("id", id);
  if (error) console.error("deleteBudget error:", error);
}

// ─── Goals ──────────────────────────────────────────────────────────────────
export async function getGoals(): Promise<Goal[]> {
  const userId = await getUserId();
  if (!userId) return [];
  const { data, error } = await supabase
    .from("goals")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("getGoals error:", error);
    return [];
  }
  return (data || []).map(mapGoal);
}

export async function addGoal(g: Omit<Goal, "id" | "createdAt">): Promise<Goal> {
  const userId = await getUserId();
  if (!userId) throw new Error("Not authenticated");
  const id = makeId("gl");
  const now = new Date().toISOString();
  const { error } = await supabase.from("goals").insert({
    id,
    user_id: userId,
    title: g.title,
    target: g.target,
    saved: g.saved,
    deadline: g.deadline || null,
    created_at: now,
  });
  if (error) console.error("addGoal error:", error);
  return { ...g, id, createdAt: now };
}

export async function updateGoal(id: string, patch: Partial<Goal>): Promise<void> {
  const updates: Record<string, any> = {};
  if (patch.title !== undefined) updates.title = patch.title;
  if (patch.target !== undefined) updates.target = patch.target;
  if (patch.saved !== undefined) updates.saved = patch.saved;
  if (patch.deadline !== undefined) updates.deadline = patch.deadline;

  const { error } = await supabase.from("goals").update(updates).eq("id", id);
  if (error) console.error("updateGoal error:", error);
}

export async function deleteGoal(id: string): Promise<void> {
  const { error } = await supabase.from("goals").delete().eq("id", id);
  if (error) console.error("deleteGoal error:", error);
}

// ─── Profile ────────────────────────────────────────────────────────────────
export interface Profile {
  name: string;
}

export async function getProfile(): Promise<Profile> {
  try {
    const userId = await getUserId();
    if (!userId) return { name: "there" };
    const { data } = await supabase
      .from("profiles")
      .select("name")
      .eq("id", userId)
      .single();
    if (data) return { name: data.name };
  } catch {}
  return { name: "there" };
}

export async function setProfile(p: Profile): Promise<void> {
  try {
    const userId = await getUserId();
    if (!userId) return;
    const { error } = await supabase
      .from("profiles")
      .update({ name: p.name })
      .eq("id", userId);
    if (error) console.error("setProfile error:", error);
  } catch {}
}

// ─── Utility: clearAllData ──────────────────────────────────────────────────
export async function clearAllData(): Promise<void> {
  const userId = await getUserId();
  if (!userId) return;
  await Promise.all([
    supabase.from("transactions").delete().eq("user_id", userId),
    supabase.from("budgets").delete().eq("user_id", userId),
    supabase.from("goals").delete().eq("user_id", userId),
    supabase.from("categories").delete().eq("user_id", userId),
  ]);
}

// ─── Seed sample data on first launch ───────────────────────────────────────
export async function seedIfNeeded(): Promise<void> {
  try {
    const userId = await getUserId();
    if (!userId) return;

    // Seed default categories for this user if they don't have any
    await getCategories();
  } catch (err) {
    console.error("seedIfNeeded error:", err);
  }
}

// ─── DB row → app model mappers (snake_case → camelCase) ────────────────────
function mapTransaction(row: any): Transaction {
  return {
    id: row.id,
    type: row.type,
    amount: Number(row.amount),
    categoryId: row.category_id,
    note: row.note || undefined,
    date: row.date,
    createdAt: row.created_at,
  };
}

function mapCategory(row: any): Category {
  return {
    id: row.id,
    name: row.name,
    icon: row.icon,
    color: row.color,
    type: row.type,
  };
}

function mapBudget(row: any): Budget {
  return {
    id: row.id,
    categoryId: row.category_id,
    limit: Number(row.limit),
    month: row.month,
  };
}

function mapGoal(row: any): Goal {
  return {
    id: row.id,
    title: row.title,
    target: Number(row.target),
    saved: Number(row.saved),
    deadline: row.deadline || undefined,
    createdAt: row.created_at,
  };
}
