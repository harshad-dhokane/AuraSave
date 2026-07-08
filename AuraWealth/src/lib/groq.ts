import { Category } from "@/src/store";

const GROQ_API_KEY = process.env.EXPO_PUBLIC_GROQ_API_KEY;

export interface ParsedIntent {
  action: "add_transaction" | "add_goal" | "add_budget" | "add_loan" | "unknown";
  confidence: "high" | "medium" | "low";
  payload: any;
  missingFields: string[];
}

export async function transcribeAudio(uri: string): Promise<string> {
  if (!GROQ_API_KEY) {
    throw new Error("Groq API key not found. Please set EXPO_PUBLIC_GROQ_API_KEY in .env");
  }

  const formData = new FormData();
  formData.append("file", {
    uri,
    name: "audio.m4a",
    type: "audio/m4a",
  } as any);
  formData.append("model", "whisper-large-v3");

  const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${GROQ_API_KEY}`,
      // Do NOT set Content-Type to multipart/form-data manually, fetch will do it with boundary
    },
    body: formData,
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to transcribe audio: ${errorText}`);
  }

  const data = await res.json();
  return data.text;
}

export async function parseIntent(text: string, categories: Category[]): Promise<ParsedIntent> {
  if (!GROQ_API_KEY) {
    throw new Error("Groq API key not found. Please set EXPO_PUBLIC_GROQ_API_KEY in .env");
  }

  const systemPrompt = `You are a highly intelligent financial assistant that parses user voice commands into structured JSON actions.
The current date is ${new Date().toISOString().split("T")[0]}.

Available Actions:
1. "add_transaction":
   - Fields: type ("expense", "income", "investment"), amount (number), categoryId (string), note (string), date (YYYY-MM-DD)
   - Available categories: ${categories.map(c => `{id: "${c.id}", name: "${c.name}", type: "${c.type}"}`).join(", ")}
2. "add_goal":
   - Fields: title (string), target (number), deadline (YYYY-MM-DD or null), saved (number, default 0)
3. "add_budget":
   - Fields: categoryId (string), limit (number), month (YYYY-MM)
4. "add_loan":
   - Fields: type ("lent" | "borrowed"), person (string), amount (number), repaymentExpected (boolean, default true), note (string)

CRITICAL RULES:
- If the user says "gave money to [person]", "lent [person]", or "borrowed from [person]", you MUST use the "add_loan" action, NOT "add_transaction".
- Only use "add_transaction" for standard expenses (e.g. food, rent, shopping) or standard income (e.g. salary, freelance).

If you are confident in all required fields, set confidence to "high". If you are mostly sure but a minor thing is missing (like category or date), set "medium". If very confused, set "low".
Return ONLY valid JSON matching this schema:
{
  "action": "add_transaction" | "add_goal" | "add_budget" | "add_loan" | "unknown",
  "confidence": "high" | "medium" | "low",
  "payload": { ...fields... },
  "missingFields": ["list", "of", "missing", "fields"]
}`;

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.1-8b-instant",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: text }
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to parse intent: ${errorText}`);
  }

  const data = await res.json();
  const content = data.choices[0].message.content;
  try {
    return JSON.parse(content) as ParsedIntent;
  } catch (e) {
    console.error("Failed to parse LLM response as JSON:", content);
    throw new Error("Invalid response from LLM");
  }
}
