import { Category, TxType } from "@/src/store";

export interface ParsedSms {
  amount: number | null;
  type: TxType | null;
  merchant: string | null;
  suggestedCategoryId: string | null;
  confidence: "high" | "medium" | "low";
}

// ── Amount detection ────────────────────────────────────────────────────────
// Captures amounts in formats: Rs.1,234.56 / INR 500 / ₹ 12,345 / $ 99.99 /
// USD 50 / EUR 12,50 etc. We only capture the number, sanitize later.
const AMOUNT_RE =
  /(?:rs\.?|inr|₹|\$|usd|eur|€|£|gbp|aed|sgd|myr|rp|idr|cad|aud)\s*([0-9]{1,3}(?:[.,][0-9]{2,3})*(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)/i;

// Fallback: "amount 1234" or "for 1234"
const AMOUNT_FALLBACK_RE = /(?:amount|amt|for|of)\s*[:.]?\s*([0-9][0-9,]{2,})/i;

// ── Direction keywords ──────────────────────────────────────────────────────
const EXPENSE_WORDS = [
  "debited", "debit", "spent", "paid", "purchase", "purchased", "withdrew",
  "withdrawn", "sent to", "transferred to", "outgoing", "charged", "billed",
  "deducted", "payment of", "you paid", "you sent", "upi debit",
];
const INCOME_WORDS = [
  "credited", "credit", "received", "deposited", "refund", "cashback",
  "salary", "reimbursement", "you received", "incoming", "credit alert",
  "upi credit",
];
const INVEST_WORDS = [
  "sip", "mutual fund", "mf ", "invested in", "investment", "nps",
  "equity purchase", "purchased units", "systematic", "folio",
];

// ── Merchant patterns ───────────────────────────────────────────────────────
// Common bank SMS: "to VPA <name>@bank", "at MERCHANT", "to MERCHANT via", "from MERCHANT"
const MERCHANT_RES = [
  /(?:to|at|towards)\s+([A-Z][A-Z0-9&'.\- ]{2,40})(?:\s+on|\s+ref|\s+via|\s+UPI|\s+for|\.|\s*$)/,
  /(?:from)\s+([A-Z][A-Z0-9&'.\- ]{2,40})(?:\s+on|\s+ref|\s+via|\s+UPI|\.|\s*$)/,
  /VPA\s+([a-z0-9._\-]+@[a-z]+)/i,
  /a\/c\s+[x*0-9]+.*?(?:to|from)\s+([A-Za-z][A-Za-z0-9&'.\- ]{2,40})/i,
];

// ── Category hints (keyword -> category id from DEFAULT_CATEGORIES) ─────────
const CATEGORY_HINTS: { keywords: string[]; catId: string; type: TxType }[] = [
  // Expense
  { keywords: ["zomato", "swiggy", "dominos", "pizza", "restaurant", "cafe", "starbucks", "burger", "kfc", "mcd", "food", "dining", "eatery"], catId: "cat-food", type: "expense" },
  { keywords: ["bigbasket", "grofers", "blinkit", "zepto", "instamart", "supermarket", "kirana", "grocery", "groceries", "reliance fresh", "dmart"], catId: "cat-groceries", type: "expense" },
  { keywords: ["uber", "ola", "rapido", "irctc", "petrol", "diesel", "hpcl", "iocl", "bpcl", "fuel", "metro", "bus ticket", "cab", "taxi"], catId: "cat-transport", type: "expense" },
  { keywords: ["amazon", "flipkart", "myntra", "ajio", "meesho", "nykaa", "shopping", "mall", "store", "purchase"], catId: "cat-shopping", type: "expense" },
  { keywords: ["electricity", "water bill", "gas bill", "airtel", "jio", "vi ", "vodafone", "bsnl", "wifi", "broadband", "postpaid", "prepaid", "recharge", "dth", "tata sky", "utility"], catId: "cat-bills", type: "expense" },
  { keywords: ["netflix", "hotstar", "prime video", "spotify", "youtube", "bookmyshow", "pvr", "inox", "cinema", "movie", "concert", "gaming"], catId: "cat-entertainment", type: "expense" },
  { keywords: ["pharmacy", "apollo", "medplus", "hospital", "clinic", "doctor", "medicine", "pharma", "practo", "1mg", "netmeds"], catId: "cat-health", type: "expense" },
  { keywords: ["rent", "landlord", "no broker", "nobroker"], catId: "cat-rent", type: "expense" },
  { keywords: ["makemytrip", "goibibo", "cleartrip", "airbnb", "oyo", "hotel", "flight", "airline", "indigo", "vistara", "spicejet", "travel", "trip"], catId: "cat-travel", type: "expense" },

  // Income
  { keywords: ["salary", "payroll", "wages", "monthly credit"], catId: "cat-salary", type: "income" },
  { keywords: ["freelance", "contract", "invoice payment", "client"], catId: "cat-freelance", type: "income" },
  { keywords: ["business", "sales", "revenue"], catId: "cat-business", type: "income" },
  { keywords: ["gift", "bonus", "reward", "cashback"], catId: "cat-gift", type: "income" },

  // Investment
  { keywords: ["sip", "systematic"], catId: "cat-sip", type: "investment" },
  { keywords: ["mutual fund", "mf ", "folio", "amc"], catId: "cat-mf", type: "investment" },
  { keywords: ["stock", "equity", "shares", "zerodha", "groww", "upstox"], catId: "cat-stocks", type: "investment" },
  { keywords: ["fixed deposit", "fd ", "recurring deposit"], catId: "cat-fd", type: "investment" },
  { keywords: ["crypto", "bitcoin", "eth ", "ethereum", "wazirx", "coindcx"], catId: "cat-crypto", type: "investment" },
  { keywords: ["gold", "sgb", "sovereign gold"], catId: "cat-gold", type: "investment" },
];

function detectType(text: string): TxType | null {
  const t = text.toLowerCase();
  // Investment first (SIP alerts often also say "debited")
  if (INVEST_WORDS.some((w) => t.includes(w))) return "investment";
  if (INCOME_WORDS.some((w) => t.includes(w))) return "income";
  if (EXPENSE_WORDS.some((w) => t.includes(w))) return "expense";
  return null;
}

function detectAmount(text: string): number | null {
  const m = text.match(AMOUNT_RE) || text.match(AMOUNT_FALLBACK_RE);
  if (!m) return null;
  // Sanitize: remove commas; if there are 2 dots keep the last as decimal? Keep it simple.
  const cleaned = m[1].replace(/,/g, "");
  const num = Number(cleaned);
  if (!isFinite(num) || num <= 0) return null;
  return num;
}

function detectMerchant(text: string): string | null {
  for (const re of MERCHANT_RES) {
    const m = text.match(re);
    if (m && m[1]) return m[1].trim().replace(/\s+/g, " ").slice(0, 40);
  }
  return null;
}

function detectCategory(text: string, type: TxType | null): string | null {
  const t = text.toLowerCase();
  for (const h of CATEGORY_HINTS) {
    if (type && h.type !== type) continue;
    if (h.keywords.some((k) => t.includes(k))) return h.catId;
  }
  return null;
}

export function parseSms(rawText: string, _cats: Category[] = []): ParsedSms {
  const text = (rawText || "").trim();
  if (!text) {
    return { amount: null, type: null, merchant: null, suggestedCategoryId: null, confidence: "low" };
  }
  const amount = detectAmount(text);
  const type = detectType(text);
  const merchant = detectMerchant(text);
  const suggestedCategoryId = detectCategory(text, type);

  let confidence: ParsedSms["confidence"] = "low";
  const hits = [amount != null, type != null, merchant != null, suggestedCategoryId != null].filter(Boolean).length;
  if (hits >= 3) confidence = "high";
  else if (hits === 2) confidence = "medium";

  return { amount, type, merchant, suggestedCategoryId, confidence };
}

// Sample messages for the demo/help UI
export const SMS_SAMPLES = [
  "Rs. 620.00 debited from A/c XX1234 to ZOMATO on 05-Jul-26. Ref 987654. Not you? Call bank.",
  "INR 85,000 credited to A/c XX9012 - Monthly SALARY from ACME CORP on 01-Jul-26. UPI Ref 445566.",
  "Payment of Rs 10,000 towards SIP in AXIS MIDCAP FUND processed. Folio 12345.",
  "You paid Rs 340 to UBER via UPI. VPA uber@paytm. Ref 998877.",
];
