import Anthropic from "@anthropic-ai/sdk";
import { TOOLS, fallbackReply, runTool, systemPrompt } from "@/lib/agent";
import { geminiReply } from "@/lib/gemini";
import type { Need } from "@/lib/mode";

interface Msg {
  role: "user" | "assistant";
  content: string;
}

// 같은 질문 반복 시 LLM 호출 비용 절감 (인스턴스 메모리 캐시)
const cache = new Map<string, string>();

export async function POST(req: Request) {
  const { messages, needs = [], showId } = (await req.json()) as {
    messages: Msg[];
    needs?: Need[];
    showId?: string;
  };
  const last = messages.at(-1)?.content ?? "";

  const cacheKey = messages.length === 1 ? `${needs.join(",")}|${showId ?? ""}|${last}` : "";
  if (cacheKey && cache.has(cacheKey)) {
    return Response.json({ reply: cache.get(cacheKey), engine: "cache" });
  }

  // 1순위: Gemini (무료 등급) → 2순위: Anthropic → 키가 없거나 실패하면 규칙 기반
  const gkey = process.env.GEMINI_API_KEY;
  if (gkey) {
    try {
      const reply = await geminiReply(gkey, systemPrompt(needs, showId), messages);
      if (cacheKey) cache.set(cacheKey, reply);
      return Response.json({ reply, engine: "gemini" });
    } catch (e) {
      console.error("[gemini]", e instanceof Error ? e.message : e); // 무료 한도 초과 등 → 아래로
    }
  }

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return Response.json({ reply: await fallbackReply(last, needs, showId), engine: "rule" });
  }

  try {
    const client = new Anthropic({ apiKey: key });
    const convo: Anthropic.MessageParam[] = messages.slice(-10).map((m) => ({ role: m.role, content: m.content }));

    for (let step = 0; step < 5; step++) {
      const res = await client.messages.create({
        model: process.env.ANTHROPIC_MODEL ?? "claude-haiku-5-5",
        max_tokens: 600,
        system: systemPrompt(needs, showId),
        tools: TOOLS,
        messages: convo,
      });

      if (res.stop_reason !== "tool_use") {
        const reply = res.content
          .filter((b): b is Anthropic.TextBlock => b.type === "text")
          .map((b) => b.text)
          .join("\n")
          .trim();
        if (cacheKey) cache.set(cacheKey, reply);
        return Response.json({ reply, engine: "llm" });
      }

      convo.push({ role: "assistant", content: res.content });
      const results: Anthropic.ToolResultBlockParam[] = [];
      for (const block of res.content) {
        if (block.type === "tool_use") {
          const out = await runTool(block.name, block.input as Record<string, string>);
          results.push({ type: "tool_result", tool_use_id: block.id, content: JSON.stringify(out) });
        }
      }
      convo.push({ role: "user", content: results });
    }
    throw new Error("tool loop limit");
  } catch {
    // LLM 장애 시에도 규칙 기반으로 응답 → 운영비 0원에서도 서비스 유지
    return Response.json({ reply: await fallbackReply(last, needs, showId), engine: "rule" });
  }
}
