// Résolution d'intention en langage naturel via LLM 100% local (EchoHub, API Messages).
// Le modèle choisit l'id de la commande la plus pertinente parmi le registre fourni.
import type { Command } from "../hooks/useCommandRegistry";

export async function nlResolve(endpoint: string, query: string, commands: Command[]): Promise<Command | null> {
  const list = commands.map((c) => `${c.id}: ${c.title}`).join("\n");
  const prompt =
    `Actions disponibles (id: description) :\n${list}\n\n` +
    `Demande de l'utilisateur : "${query}"\n` +
    `Réponds UNIQUEMENT par l'id exact de l'action la plus pertinente, ou "none" si aucune ne convient.`;
  const res = await fetch(`${endpoint.replace(/\/$/, "")}/v1/messages`, {
    method: "POST",
    headers: { "content-type": "application/json", "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: "haiku", max_tokens: 32, messages: [{ role: "user", content: prompt }] }),
  });
  if (!res.ok) throw new Error(`LLM local: ${res.status}`);
  const data = await res.json();
  const text = String(data?.content?.[0]?.text ?? "").trim().toLowerCase();
  return commands.find((c) => text.includes(c.id)) ?? null;
}
