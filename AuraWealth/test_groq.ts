import { parseIntent } from "./src/lib/groq";

const cats = [
  { id: "cat-food", name: "Food & Dining", icon: "restaurant", color: "#ccc", type: "expense" },
  { id: "cat-transport", name: "Transport", icon: "car", color: "#ccc", type: "expense" },
  { id: "cat-shopping", name: "Shopping", icon: "bag-handle", color: "#ccc", type: "expense" },
  { id: "cat-bills", name: "Bills", icon: "receipt", color: "#ccc", type: "expense" }
];

async function main() {
  const result = await parseIntent("spent 4 thousand on dinner today", cats as any);
  console.log(JSON.stringify(result, null, 2));
}

main().catch(console.error);
