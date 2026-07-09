import { Category } from "@/src/store";

const GROQ_API_KEY = process.env.EXPO_PUBLIC_GROQ_API_KEY;

export interface ParsedIntent {
  action: "add_transaction" | "add_goal" | "add_budget" | "add_loan" | "unknown";
  confidence: "high" | "medium" | "low";
  payload: any;
  missingFields: string[];
}

// ── User-friendly error messages ────────────────────────────────────────────
// These replace raw API error text so the user never sees JSON or HTTP codes.
function friendlyError(rawMessage: string): string {
  const lower = rawMessage.toLowerCase();
  if (lower.includes("api key") || lower.includes("401") || lower.includes("invalid")) {
    return "Voice assistant is not configured. Please add your Groq API key in settings.";
  }
  if (lower.includes("rate limit") || lower.includes("429")) {
    return "Too many requests — please wait a moment and try again.";
  }
  if (lower.includes("network") || lower.includes("fetch") || lower.includes("connection")) {
    return "Network error — check your internet connection.";
  }
  if (lower.includes("timeout") || lower.includes("timed out")) {
    return "Request timed out — try speaking again.";
  }
  if (lower.includes("no recording") || lower.includes("no audio") || lower.includes("uri")) {
    return "Could not capture audio. Hold the button and speak clearly.";
  }
  return "Something went wrong. Please try again.";
}

// ── Audio Transcription (Whisper via Groq) ──────────────────────────────────
export async function transcribeAudio(uri: string): Promise<string> {
  if (!GROQ_API_KEY || GROQ_API_KEY.trim().length === 0) {
    throw new Error(friendlyError("api key"));
  }

  const formData = new FormData();
  formData.append("file", {
    uri,
    name: "audio.m4a",
    type: "audio/m4a",
  } as any);
  formData.append("model", "whisper-large-v3-turbo");
  // Improve accuracy — allow multilingual input (Hindi, English, etc.)
  formData.append("response_format", "text");

  let res: Response;
  try {
    res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: formData,
    });
  } catch (networkErr: any) {
    throw new Error(friendlyError(networkErr.message || "network"));
  }

  if (!res.ok) {
    const errorText = await res.text().catch(() => "");
    console.warn("[AuraWealth] Transcription error:", res.status, errorText);
    throw new Error(friendlyError(errorText || String(res.status)));
  }

  const text = await res.text();
  const trimmed = text.trim();
  if (!trimmed || trimmed.length < 2) {
    throw new Error("Couldn't hear anything. Please speak clearly and try again.");
  }
  return trimmed;
}

// ── Intent Parsing (LLM via Groq) ───────────────────────────────────────────
export async function parseIntent(text: string, categories: Category[]): Promise<ParsedIntent> {
  if (!GROQ_API_KEY || GROQ_API_KEY.trim().length === 0) {
    throw new Error(friendlyError("api key"));
  }

  const today = new Date().toISOString().split("T")[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];

  const catList = categories
    .map(c => `  - id: "${c.id}", name: "${c.name}", type: "${c.type}"`)
    .join("\n");

  const systemPrompt = `You are a smart financial assistant built into the "Aura Wealth" expense tracker app. Your ONLY job is to parse the user's spoken command and output a SINGLE JSON object.

## Today's date: ${today}
## Yesterday's date: ${yesterday}

## AVAILABLE CATEGORIES:
${catList}

## AVAILABLE ACTIONS:

### 1. "add_transaction"
Use for: everyday expenses, income, investments.
Payload fields:
  - type: "expense" | "income" | "investment" (REQUIRED)
  - amount: number (REQUIRED)
  - categoryId: string (REQUIRED — you MUST semantically map the user's spoken item to the most appropriate category name from the AVAILABLE CATEGORIES list above. For example, if the user says "dinner" or "lunch", map it to "Food & Dining". You MUST output the exact 'id' string of the matched category, NOT the name. Example: "cat_123")
  - note: string (a brief description, REQUIRED — use what the user said)
  - date: "YYYY-MM-DD" (default: "${today}". Use "${yesterday}" if user says "yesterday")

### 2. "add_loan"
Use for: lending money, borrowing money, giving to someone, receiving from someone.
Keywords: "gave", "lent", "borrowed", "sent money", "paid [person]", "owes me", "I owe"
Payload fields:
  - type: "lent" | "borrowed" (REQUIRED — "lent" = user gave money, "borrowed" = user received money)
  - person: string (REQUIRED — the name of the person)
  - amount: number (REQUIRED)
  - repaymentExpected: boolean (default true. Set false if user says "gift", "no repayment", "donation")
  - notes: string (what the money was for — include any context the user mentioned)
  - date: "YYYY-MM-DD" (default: "${today}". Use "${yesterday}" if user says "yesterday")
  - dueDate: "YYYY-MM-DD" or null (REQUIRED — the expected repayment date if mentioned, e.g. "by next week", "on 15th")
  - interestRate: number or null (REQUIRED — the interest rate percentage if mentioned, e.g. "at 5 percent interest")

### 3. "add_goal"
Use for: savings goals, targets.
Keywords: "save for", "goal", "target", "want to buy"
Payload fields:
  - title: string (REQUIRED)
  - target: number (REQUIRED — the total amount to save)
  - saved: number (default: 0)
  - goalYears: number (default: 1 — the number of years for the goal period, if mentioned)
  - goalMonths: number (default: 0 — the number of months for the goal period, if mentioned)
  - goalDays: number (default: 0 — the number of days for the goal period, if mentioned)

### 4. "add_budget"
Use for: setting monthly spending limits.
Keywords: "budget", "limit", "monthly limit"
Payload fields:
  - categoryId: string (REQUIRED — from AVAILABLE CATEGORIES)
  - limit: number (REQUIRED)
  - month: "YYYY-MM" (default: "${today.slice(0, 7)}")

## CRITICAL RULES:
1. If the user mentions a PERSON's NAME and giving/receiving money → use "add_loan", NOT "add_transaction".
2. NEVER invent a category ID. You MUST semantically map the user's spoken item (e.g. "dinner") to the conceptually closest category name (e.g. "Food & Dining"), and output that category's EXACT 'id' string.
3. If the user says amounts in words (like "two hundred", "fifty"), convert to numbers.
4. If user says "yesterday", use "${yesterday}". If they say "today" or no date, use "${today}".
5. For expenses: pick type "expense". For salary/freelance/received income: pick "income". For stocks/mutual funds/SIP: pick "investment".
6. The "note" field for transactions should be a brief, useful description (e.g. "Lunch at restaurant", "Monthly salary", "SIP payment").
7. For loans, the "notes" field should capture what the money was for (e.g. "For dinner", "Trip expenses", "Birthday gift").
8. If you cannot understand the command at all, use action "unknown".
9. ALWAYS include ALL required payload fields — never leave them out.

## OUTPUT FORMAT:
Return ONLY a valid JSON object:
{
  "action": "add_transaction" | "add_goal" | "add_budget" | "add_loan" | "unknown",
  "confidence": "high" | "medium" | "low",
  "payload": { ... },
  "missingFields": []
}`;

  let res: Response;
  try {
    res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: text },
        ],
        response_format: { type: "json_object" },
        temperature: 0.05,
        max_tokens: 512,
      }),
    });
  } catch (networkErr: any) {
    throw new Error(friendlyError(networkErr.message || "network"));
  }

  if (!res.ok) {
    const errorText = await res.text().catch(() => "");
    console.warn("[AuraWealth] LLM parse error:", res.status, errorText);
    throw new Error(friendlyError(errorText || String(res.status)));
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  
  if (!content) {
    throw new Error("Could not understand. Please try speaking more clearly.");
  }

  try {
    const parsed = JSON.parse(content) as ParsedIntent;
    
    // Validate the parsed intent has required structure
    if (!parsed.action || !parsed.payload) {
      return {
        action: "unknown",
        confidence: "low",
        payload: {},
        missingFields: [],
      };
    }
    
    // Fallback: If LLM returned a category name instead of an ID, try to match it
    if (parsed.payload.categoryId) {
      const exactMatch = categories.find(c => c.id === parsed.payload.categoryId);
      if (!exactMatch) {
        // Try fuzzy matching by name
        const fuzzyMatch = categories.find(c => 
          c.name.toLowerCase() === String(parsed.payload.categoryId).toLowerCase() ||
          String(parsed.payload.categoryId).toLowerCase().includes(c.name.toLowerCase()) ||
          c.name.toLowerCase().includes(String(parsed.payload.categoryId).toLowerCase())
        );
        if (fuzzyMatch) {
          parsed.payload.categoryId = fuzzyMatch.id;
        }
      }
    }
    
    // Ensure missingFields is always an array
    if (!Array.isArray(parsed.missingFields)) {
      parsed.missingFields = [];
    }
    
    return parsed;
  } catch (e) {
    console.warn("[AuraWealth] Failed to parse LLM JSON:", content);
    throw new Error("Could not understand. Please try again with a clearer command.");
  }
}
