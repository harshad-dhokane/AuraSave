import AsyncStorage from "@react-native-async-storage/async-storage";
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

// ─── Storage Keys ───────────────────────────────────────────────────────────
const KEYS = {
  transactions: "aura:transactions",
  categories: "aura:categories",
  budgets: "aura:budgets",
  goals: "aura:goals",
  profile: "aura:profile",
  seeded: "aura:seeded_v1",
};

// ─── Generic helpers ────────────────────────────────────────────────────────
async function readList<T>(key: string, fallback: T[] = []): Promise<T[]> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T[];
  } catch {
    return fallback;
  }
}

async function writeList<T>(key: string, list: T[]): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(list));
}

// ─── ID generator (no external uuid dep) ────────────────────────────────────
export function makeId(prefix = "id"): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// ─── Transactions ───────────────────────────────────────────────────────────
export async function getTransactions(): Promise<Transaction[]> {
  return readList<Transaction>(KEYS.transactions);
}
export async function addTransaction(tx: Omit<Transaction, "id" | "createdAt">): Promise<Transaction> {
  const list = await getTransactions();
  const full: Transaction = { ...tx, id: makeId("tx"), createdAt: new Date().toISOString() };
  await writeList(KEYS.transactions, [full, ...list]);
  return full;
}
export async function deleteTransaction(id: string): Promise<void> {
  const list = await getTransactions();
  await writeList(KEYS.transactions, list.filter((t) => t.id !== id));
}

// ─── Categories ─────────────────────────────────────────────────────────────
export async function getCategories(): Promise<Category[]> {
  const stored = await readList<Category>(KEYS.categories, []);
  if (stored.length === 0) {
    await writeList(KEYS.categories, DEFAULT_CATEGORIES);
    return DEFAULT_CATEGORIES;
  }
  return stored;
}
export async function addCategory(cat: Omit<Category, "id">): Promise<Category> {
  const list = await getCategories();
  const full: Category = { ...cat, id: makeId("cat") };
  await writeList(KEYS.categories, [...list, full]);
  return full;
}

// ─── Budgets ────────────────────────────────────────────────────────────────
export async function getBudgets(): Promise<Budget[]> {
  return readList<Budget>(KEYS.budgets);
}
export async function upsertBudget(b: Omit<Budget, "id"> & { id?: string }): Promise<Budget> {
  const list = await getBudgets();
  const existing = list.find((x) => x.categoryId === b.categoryId && x.month === b.month);
  if (existing) {
    existing.limit = b.limit;
    await writeList(KEYS.budgets, list);
    return existing;
  }
  const full: Budget = { ...b, id: makeId("bg") };
  await writeList(KEYS.budgets, [...list, full]);
  return full;
}
export async function deleteBudget(id: string): Promise<void> {
  const list = await getBudgets();
  await writeList(KEYS.budgets, list.filter((b) => b.id !== id));
}

// ─── Goals ──────────────────────────────────────────────────────────────────
export async function getGoals(): Promise<Goal[]> {
  return readList<Goal>(KEYS.goals);
}
export async function addGoal(g: Omit<Goal, "id" | "createdAt">): Promise<Goal> {
  const list = await getGoals();
  const full: Goal = { ...g, id: makeId("gl"), createdAt: new Date().toISOString() };
  await writeList(KEYS.goals, [...list, full]);
  return full;
}
export async function updateGoal(id: string, patch: Partial<Goal>): Promise<void> {
  const list = await getGoals();
  const idx = list.findIndex((g) => g.id === id);
  if (idx >= 0) {
    list[idx] = { ...list[idx], ...patch };
    await writeList(KEYS.goals, list);
  }
}
export async function deleteGoal(id: string): Promise<void> {
  const list = await getGoals();
  await writeList(KEYS.goals, list.filter((g) => g.id !== id));
}

// ─── Profile ────────────────────────────────────────────────────────────────
export interface Profile {
  name: string;
}
export async function getProfile(): Promise<Profile> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.profile);
    if (raw) return JSON.parse(raw) as Profile;
  } catch {}
  return { name: "there" };
}
export async function setProfile(p: Profile): Promise<void> {
  await AsyncStorage.setItem(KEYS.profile, JSON.stringify(p));
}

// ─── Utility: reset all ─────────────────────────────────────────────────────
export async function clearAllData(): Promise<void> {
  await AsyncStorage.multiRemove([
    KEYS.transactions,
    KEYS.budgets,
    KEYS.goals,
    KEYS.categories,
    KEYS.seeded,
  ]);
}

// ─── Seed sample data on first launch (for a beautiful first impression) ────
export async function seedIfNeeded(): Promise<void> {
  const seeded = await AsyncStorage.getItem(KEYS.seeded);
  if (seeded) return;

  await getCategories(); // triggers default cat seed
  const now = new Date();
  const iso = (daysAgo: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() - daysAgo);
    return d.toISOString();
  };

  const sample: Omit<Transaction, "id" | "createdAt">[] = [
    { type: "income", amount: 85000, categoryId: "cat-salary", note: "Monthly salary", date: iso(2) },
    { type: "expense", amount: 18500, categoryId: "cat-rent", note: "May rent", date: iso(3) },
    { type: "expense", amount: 2450, categoryId: "cat-groceries", note: "BigBasket", date: iso(1) },
    { type: "expense", amount: 620, categoryId: "cat-food", note: "Dinner", date: iso(0) },
    { type: "expense", amount: 340, categoryId: "cat-transport", note: "Uber", date: iso(0) },
    { type: "expense", amount: 1200, categoryId: "cat-entertainment", note: "Movie night", date: iso(4) },
    { type: "expense", amount: 899, categoryId: "cat-shopping", note: "T-shirt", date: iso(5) },
    { type: "expense", amount: 2100, categoryId: "cat-bills", note: "Electricity", date: iso(6) },
    { type: "investment", amount: 10000, categoryId: "cat-sip", note: "SIP - Nifty50", date: iso(2) },
    { type: "investment", amount: 5000, categoryId: "cat-stocks", note: "HDFC Bank", date: iso(7) },
    { type: "income", amount: 12000, categoryId: "cat-freelance", note: "Client project", date: iso(9) },
  ];
  for (const s of sample) await addTransaction(s);

  const mk = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  await upsertBudget({ categoryId: "cat-food", limit: 6000, month: mk });
  await upsertBudget({ categoryId: "cat-groceries", limit: 8000, month: mk });
  await upsertBudget({ categoryId: "cat-entertainment", limit: 3000, month: mk });
  await upsertBudget({ categoryId: "cat-shopping", limit: 5000, month: mk });

  await addGoal({ title: "Emergency Fund", target: 100000, saved: 42000 });
  await addGoal({ title: "Goa Vacation", target: 50000, saved: 15000 });

  await AsyncStorage.setItem(KEYS.seeded, "true");
}
