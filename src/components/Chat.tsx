"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Mic, Volume2, VolumeX } from "lucide-react";
import { useNeeds } from "@/lib/mode";

interface Msg {
  role: "user" | "assistant";
  content: string;
}

const SUGGEST = [
  "올림픽공원역에서 KSPO DOME까지 계단 없이 가는 길 알려줘",
  "비 오는데 몽촌토성역에서 올림픽홀 어떻게 가요?",
  "휠체어석에서 무대 잘 보여요?",
  "공연장 근처 장애인 화장실 어디 있어요?",
];

type SpeechRec = {
  lang: string;
  interimResults: boolean;
  onresult: (e: { results: { 0: { transcript: string } }[] }) => void;
  onend: () => void;
  start: () => void;
};

export default function Chat() {
  const { needs, bigText } = useNeeds();
  const senior = bigText;
  const showId = useSearchParams().get("show") ?? undefined;
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [speak, setSpeak] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, loading]);

  const send = async (text: string) => {
    const t = text.trim();
    if (!t || loading) return;
    const next: Msg[] = [...msgs, { role: "user", content: t }];
    setMsgs(next);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next, needs: needs ?? [], showId }),
      });
      const { reply } = await res.json();
      setMsgs([...next, { role: "assistant", content: reply }]);
      if (speak && "speechSynthesis" in window) {
        const u = new SpeechSynthesisUtterance(reply.replace(/\(현재 샘플 데이터 기준\)/, ""));
        u.lang = "ko-KR";
        u.rate = senior ? 0.9 : 1;
        window.speechSynthesis.speak(u);
      }
    } catch {
      setMsgs([...next, { role: "assistant", content: "잠시 연결이 불안정해요. 다시 한 번 물어봐 주세요." }]);
    } finally {
      setLoading(false);
    }
  };

  const listen = () => {
    const W = window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec };
    const Ctor = W.SpeechRecognition ?? W.webkitSpeechRecognition;
    if (!Ctor) {
      alert("이 브라우저는 음성 입력을 지원하지 않아요. 글자로 입력해 주세요.");
      return;
    }
    const rec = new Ctor();
    rec.lang = "ko-KR";
    rec.interimResults = false;
    rec.onresult = (e) => send(e.results[0][0].transcript);
    rec.onend = () => setListening(false);
    setListening(true);
    rec.start();
  };

  const bubble = senior ? "text-[1.0625rem]" : "text-[0.9375rem]";
  return (
    <div className={`band flex flex-1 flex-col px-5 pt-2 ${senior ? "pb-64" : "pb-44"}`}>
      <div className="flex items-center justify-between">
        <h1 className="text-[1.5rem] font-bold tracking-tight">물어보기</h1>
        <button
          onClick={() => setSpeak(!speak)}
          aria-pressed={speak}
          className={`press flex min-h-9 items-center gap-1.5 rounded-full px-3.5 text-[0.8125rem] font-semibold ${speak ? "bg-blue-soft text-blue" : "bg-grey-100 text-ink-3"}`}
        >
          {speak ? <Volume2 size={16} aria-hidden /> : <VolumeX size={16} aria-hidden />}
          {speak ? "읽어주는 중" : "읽어주기"}
        </button>
      </div>

      <div className={`mt-5 flex flex-col gap-2.5 ${msgs.length ? "flex-1" : ""}`} aria-live="polite">
        <div className={`max-w-[85%] rounded-[1.25rem] rounded-tl-md bg-grey-100 px-4 py-3 leading-relaxed ${bubble}`}>
          {senior
            ? "안녕하세요. 어디서 출발해서 어느 공연장에 가시는지 말씀해 주시면 편한 길을 알려드릴게요."
            : "가는 길, 계단·엘리베이터, 휠체어석 시야, 화장실 위치까지 물어보세요."}
        </div>
        {msgs.map((msg, i) => (
          <div
            key={i}
            className={`max-w-[85%] whitespace-pre-line px-4 py-3 leading-relaxed ${bubble} ${
              msg.role === "user"
                ? "self-end rounded-[1.25rem] rounded-tr-md bg-blue text-white"
                : "rounded-[1.25rem] rounded-tl-md bg-grey-100"
            }`}
          >
            {msg.content}
          </div>
        ))}
        {loading && (
          <div className="flex w-16 gap-1 rounded-[1.25rem] rounded-tl-md bg-grey-100 px-4 py-4" aria-label="답변 작성 중">
            {[0, 1, 2].map((i) => (
              <span key={i} className="h-1.5 w-1.5 animate-pulse rounded-full bg-ink-3" style={{ animationDelay: `${i * 150}ms` }} />
            ))}
          </div>
        )}
        <div ref={endRef} />
      </div>

      {msgs.length === 0 && (
        <div className="mt-6">
          <p className="text-[0.8125rem] font-semibold text-ink-3">이렇게 물어보세요</p>
          <div className="mt-2 flex flex-col gap-2">
            {SUGGEST.map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                className={`press rounded-2xl bg-grey-50 px-4 py-3 text-left font-medium text-ink-2 ${bubble}`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="fixed bottom-[3.75rem] left-1/2 z-30 w-full max-w-[480px] -translate-x-1/2 bg-bg px-4 pb-3 pt-2">
        {senior && (
          <button
            onClick={listen}
            className={`press mb-2 flex h-14 w-full items-center justify-center gap-2 rounded-2xl text-[1.0625rem] font-semibold text-white ${listening ? "bg-blue-dark" : "bg-blue"}`}
          >
            <Mic size={22} aria-hidden className={listening ? "animate-pulse" : ""} />
            {listening ? "듣고 있어요, 말씀하세요" : "눌러서 말로 물어보기"}
          </button>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="flex items-center gap-2 rounded-2xl bg-grey-100 p-1.5 pl-4"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={senior ? "글자로 물어보기" : "무엇이든 물어보세요"}
            aria-label="질문 입력"
            className={`min-w-0 flex-1 bg-transparent outline-none placeholder:text-ink-3 ${bubble}`}
          />
          {!senior && (
            <button type="button" onClick={listen} aria-label="음성으로 입력" className={`press grid h-10 w-10 place-items-center rounded-xl ${listening ? "text-blue" : "text-ink-2"}`}>
              <Mic size={20} aria-hidden className={listening ? "animate-pulse" : ""} />
            </button>
          )}
          <button
            type="submit"
            disabled={!input.trim()}
            aria-label="보내기"
            className="press grid h-10 w-10 place-items-center rounded-xl bg-blue text-white disabled:bg-grey-200"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
              <path d="M12 19V5m-6 6 6-6 6 6" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
}
