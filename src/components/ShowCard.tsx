"use client";

/**
 * 보여주기 카드 — 소리가 잘 안 들리거나 말로 설명하기 어려울 때, 직원에게 화면을 보여주는 큰 글씨 문장.
 * 저장해 둔 내 자리와 다음 공연을 자동으로 넣는다. 인터넷 없이도 동작(오프라인 저장).
 */
import { useState } from "react";
import { Maximize2, RotateCcw, X } from "lucide-react";
import { useNeeds } from "@/lib/mode";
import { useSaved, type MySeat } from "@/lib/offline";

type Next = { title: string; venue: string; date: string; start: string } | null;

export default function ShowCard({ nextShow }: { nextShow: Next }) {
  const { has } = useNeeds();
  const seat = useSaved<MySeat>("seat");
  const seatText = seat ? seat.label : "제 자리";
  const showText = nextShow ? `${nextShow.title.replace("[샘플] ", "").replace(/^\[[^\]]+\]\s*/, "")} (${nextShow.venue})` : "오늘 공연";
  const PHRASES = [
    ...(has("hearing") ? [`저는 소리가 잘 안 들려요.\n글로 써서 알려주세요.`] : []),
    `휠체어석으로 입장하려고 해요.\n엘리베이터가 있는 입구를 알려주세요.`,
    `제 자리는 ${seatText}이에요.\n자리까지 안내해 주세요.`,
    `${showText}\n자막이나 수어 통역이 있나요?`,
    `장애인 화장실이 어디에 있나요?`,
    `동반인과 함께 앉을 수 있나요?`,
    `공연이 끝나고 사람이 빠진 뒤에 나가고 싶어요.\n기다릴 곳이 있나요?`,
    ...(has("hearing") ? [] : [`저는 소리가 잘 안 들려요.\n글로 써서 알려주세요.`]),
    `물건을 잃어버렸어요.\n어디에 문의하면 되나요?`,
  ];
  const [sel, setSel] = useState<string | null>(null);
  const [mine, setMine] = useState("");
  const [flip, setFlip] = useState(false);
  const [reply, setReply] = useState("");

  if (sel) {
    return (
      <div role="dialog" aria-modal="true" aria-label="보여주기 카드" className="fixed inset-0 z-[60] mx-auto flex max-w-[480px] flex-col bg-[#fffbe6]">
        <div className="flex items-center justify-between p-3">
          <button onClick={() => setFlip(!flip)} className="press flex h-12 items-center gap-1.5 rounded-full bg-black/5 px-4 text-[0.9375rem] font-semibold">
            <RotateCcw size={18} aria-hidden /> {flip ? "바로 보기" : "상대 쪽으로 뒤집기"}
          </button>
          <button
            onClick={() => {
              setSel(null);
              setFlip(false);
              setReply("");
            }}
            aria-label="카드 닫기"
            className="press grid h-12 w-12 place-items-center rounded-full bg-black/5"
          >
            <X size={24} />
          </button>
        </div>
        <div className={`flex flex-1 flex-col px-6 pb-6 transition-transform duration-300 ${flip ? "rotate-180" : ""}`}>
          <p className="flex-1 whitespace-pre-line pt-6 text-[2.25rem] font-extrabold leading-[1.35] tracking-tight text-[#111]">{sel}</p>
          <label className="mt-4 block">
            <span className="text-[0.9375rem] font-semibold text-[#5c4a00]">직원분, 여기에 답을 써 주세요</span>
            <textarea
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              rows={3}
              className="mt-2 w-full rounded-2xl border-2 border-[#e8d58a] bg-white p-4 text-[1.5rem] font-bold leading-snug outline-none focus:border-[#191f28]"
            />
          </label>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-24">
      <section className="band px-5 pb-6 pt-5">
        <h1 className="text-[1.5rem] font-bold tracking-tight">보여주기 카드</h1>
        <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-ink-2">
          말로 묻기 어려울 때 직원에게 화면을 보여주세요. 문장을 누르면 크게 보여요. 인터넷이 끊겨도 쓸 수 있어요.
        </p>
        {seat && (
          <p className="mt-3 rounded-2xl bg-grey-50 px-4 py-3 text-[0.875rem] text-ink-2">
            저장한 내 자리: <b className="text-ink">{seat.label}</b>
          </p>
        )}
      </section>
      <ul className="mt-3 flex flex-col gap-2 px-4">
        {PHRASES.map((p) => (
          <li key={p}>
            <button onClick={() => setSel(p)} className="press flex w-full items-center gap-3 rounded-2xl bg-bg px-5 py-4 text-left">
              <span className="flex-1 whitespace-pre-line text-[1.0625rem] font-semibold leading-snug">{p}</span>
              <Maximize2 size={18} className="shrink-0 text-ink-3" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
      <section className="band mx-4 mt-3 rounded-3xl px-5 py-5">
        <label htmlFor="mine" className="text-[1rem] font-bold">
          직접 쓰기
        </label>
        <textarea
          id="mine"
          value={mine}
          onChange={(e) => setMine(e.target.value)}
          rows={3}
          placeholder="예: 보조견과 함께 왔어요"
          className="mt-2 w-full rounded-2xl bg-grey-50 p-4 text-[1.0625rem] outline-none focus:ring-2 focus:ring-blue"
        />
        <button
          disabled={!mine.trim()}
          onClick={() => setSel(mine.trim())}
          className="press mt-2 h-12 w-full rounded-2xl bg-ink text-[1rem] font-bold text-white disabled:opacity-40"
        >
          크게 보여주기
        </button>
      </section>
    </div>
  );
}
