import type { ProviderId } from "@repro/monitor-contracts";
import { instruction } from "./codex.js";
export interface Price {
  inputPerMillion: number;
  outputPerMillion: number;
  verifiedAt: string;
}
export function reservation(prompt: string, price: Price): number {
  if (
    !price ||
    !Number.isFinite(price.inputPerMillion) ||
    !Number.isFinite(price.outputPerMillion) ||
    price.inputPerMillion < 0 ||
    price.outputPerMillion <= 0 ||
    !Number.isFinite(Date.parse(price.verifiedAt)) ||
    Date.now() - Date.parse(price.verifiedAt) > 31 * 86400000
  )
    throw new Error("Current verified model pricing is required");
  return (
    ((Buffer.byteLength(prompt + instruction) + 512) * price.inputPerMillion +
      2048 * price.outputPerMillion) /
    1e6
  );
}
export async function paidModels(
  provider: "openai" | "grok",
  key: string,
): Promise<string[]> {
  const r = await fetch(
    `${provider === "openai" ? "https://api.openai.com" : "https://api.x.ai"}/v1/models`,
    {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(10000),
      redirect: "error",
    },
  );
  if (!r.ok) throw new Error(`Provider authentication failed (${r.status})`);
  const d = (await r.json()) as { data: { id: string }[] };
  return d.data.map((m) => m.id).slice(0, 200);
}
export async function paidAnalyze(
  provider: ProviderId,
  key: string,
  model: string,
  prompt: string,
  onDelta: (s: string) => void,
): Promise<{
  text: string;
  input: number | null;
  output: number | null;
  actualUsd: number | null;
}> {
  const base =
    provider === "openai" ? "https://api.openai.com" : "https://api.x.ai";
  const r = await fetch(`${base}/v1/responses`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      instructions: instruction,
      input: prompt,
      stream: true,
      store: false,
      max_output_tokens: 2048,
      tools: [],
    }),
    signal: AbortSignal.timeout(120000),
    redirect: "error",
  });
  if (!r.ok || !r.body) throw new Error(`AI provider returned ${r.status}`);
  let text = "",
    buffer = "",
    input: number | null = null,
    output: number | null = null,
    actualUsd: number | null = null,
    completed = false;
  const decoder = new TextDecoder();
  for await (const bytes of r.body) {
    buffer += decoder.decode(bytes, { stream: true });
    if (buffer.length > 1_000_000)
      throw new Error("Provider frame exceeds limit");
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data: ") || line === "data: [DONE]") continue;
      const event = JSON.parse(line.slice(6));
      if (event.type === "response.output_text.delta") {
        const delta = String(event.delta);
        if (text.length + delta.length > 24000)
          throw new Error("AI output limit exceeded");
        text += delta;
        onDelta(delta);
      }
      if (event.type === "response.completed") {
        completed = true;
        const usage = event.response?.usage;
        input = usage?.input_tokens ?? null;
        output = usage?.output_tokens ?? null;
        if (typeof usage?.cost_in_usd_ticks === "number")
          actualUsd = usage.cost_in_usd_ticks / 1e10;
      }
      if (event.type === "response.failed" || event.type === "error")
        throw new Error("AI response failed");
    }
  }
  if (!completed) throw new Error("AI stream ended before completion");
  return { text, input, output, actualUsd };
}
