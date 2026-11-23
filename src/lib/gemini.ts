/** Google Gemini API (무료 등급 사용 가능) — REST 함수 호출 루프 */
import { TOOLS, runTool } from "./agent";

interface Msg {
  role: "user" | "assistant";
  content: string;
}

type Part = { text?: string; functionCall?: { name: string; args?: Record<string, unknown> }; functionResponse?: unknown };
type Content = { role: "user" | "model"; parts: Part[] };

const declarations = TOOLS.map((t) => ({
  name: t.name,
  description: t.description,
  parameters: Object.keys(t.input_schema.properties ?? {}).length ? t.input_schema : undefined,
}));

export async function geminiReply(key: string, system: string, messages: Msg[]): Promise<string> {
  const model = process.env.GEMINI_MODEL ?? "gemini-flash-latest";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const contents: Content[] = messages.slice(-10).map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  for (let step = 0; step < 5; step++) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents,
        tools: [{ functionDeclarations: declarations }],
        generationConfig: { maxOutputTokens: 700, temperature: 0.3 },
      }),
    });
    if (!res.ok) throw new Error(`gemini ${res.status}`);
    const data = await res.json();
    const parts: Part[] = data?.candidates?.[0]?.content?.parts ?? [];
    const calls = parts.filter((p) => p.functionCall);
    if (calls.length === 0) {
      const text = parts.map((p) => p.text ?? "").join("").trim();
      if (!text) throw new Error("empty");
      return text;
    }
    contents.push({ role: "model", parts });
    const responses: Part[] = [];
    for (const c of calls) {
      const out = await runTool(c.functionCall!.name, (c.functionCall!.args ?? {}) as Record<string, string>);
      responses.push({ functionResponse: { name: c.functionCall!.name, response: { content: out } } });
    }
    contents.push({ role: "user", parts: responses });
  }
  throw new Error("tool loop limit");
}
