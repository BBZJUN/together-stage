"use client";

import { createContext, useContext, useEffect, useState } from "react";

/** 사용자가 고른 도움 유형 (복수 선택) */
export type Need = "wheelchair" | "mobility" | "lowvision" | "hearing" | "companion";

const KEY = "together-needs";

interface Ctx {
  needs: Need[] | null; // null = 아직 선택 안 함
  setNeeds: (n: Need[]) => void;
  has: (n: Need) => boolean;
  bigText: boolean;
}

const NeedsCtx = createContext<Ctx>({ needs: null, setNeeds: () => {}, has: () => false, bigText: false });

function readStored(): Need[] | null {
  try {
    const v = localStorage.getItem(KEY);
    return v ? (JSON.parse(v) as Need[]) : null;
  } catch {
    return null;
  }
}

export function ModeProvider({ children }: { children: React.ReactNode }) {
  const [needs, setState] = useState<Need[] | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState(readStored());
  }, []);
  const bigText = !!needs?.includes("lowvision") || !!needs?.includes("companion");
  useEffect(() => {
    document.documentElement.classList.toggle("senior", bigText);
  }, [bigText]);
  const setNeeds = (n: Need[]) => {
    setState(n);
    try {
      localStorage.setItem(KEY, JSON.stringify(n));
    } catch {
      /* 저장 불가 환경 */
    }
  };
  return (
    <NeedsCtx.Provider value={{ needs, setNeeds, has: (n) => !!needs?.includes(n), bigText }}>{children}</NeedsCtx.Provider>
  );
}

export const useNeeds = () => useContext(NeedsCtx);

export const NEED_META: Record<Need, { label: string; desc: string; emoji: string }> = {
  wheelchair: { label: "휠체어를 타요", desc: "계단 없는 길, 휠체어석 시야", emoji: "♿" },
  mobility: { label: "계단이 힘들어요", desc: "다리가 불편하거나 유모차를 끌어요", emoji: "🦯" },
  lowvision: { label: "글씨가 잘 안 보여요", desc: "큰 글씨와 소리 안내", emoji: "🔎" },
  hearing: { label: "소리가 잘 안 들려요", desc: "문자 안내, 자막·수어 공연 정보", emoji: "🧏" },
  companion: { label: "어르신과 함께 가요", desc: "쉬어갈 곳, 짧고 편한 길", emoji: "🧓" },
};
