"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Armchair, House, MessageCircle, Navigation, SlidersHorizontal } from "lucide-react";
import { NEED_META, useNeeds } from "@/lib/mode";
import { Wordmark } from "./brand/Logo";

export function Header() {
  const { needs } = useNeeds();
  const path = usePathname();
  if (path.startsWith("/shows")) return null;
  return (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between bg-bg/95 px-5 backdrop-blur">
      <Link href="/" aria-label="함께 보는 무대 홈">
        <Wordmark />
      </Link>
      {needs && (
        <Link
          href="/?pick=1"
          aria-label={`도움 설정: ${needs.length ? needs.map((n) => NEED_META[n].short).join(", ") : "없음"}. 바꾸기`}
          className="press flex h-9 items-center gap-1.5 rounded-full bg-grey-100 pl-2.5 pr-3 text-[0.8125rem] font-semibold text-ink-2"
        >
          {needs.length ? (
            <span className="flex -space-x-1">
              {needs.slice(0, 3).map((n) => {
                const I = NEED_META[n].icon;
                return (
                  <span key={n} className="grid h-5 w-5 place-items-center rounded-full bg-bg ring-2 ring-grey-100">
                    <I size={12} strokeWidth={2.5} />
                  </span>
                );
              })}
            </span>
          ) : (
            <SlidersHorizontal size={14} />
          )}
          내 설정
        </Link>
      )}
    </header>
  );
}

const TABS = [
  { href: "/", label: "홈", icon: House },
  { href: "/route", label: "길찾기", icon: Navigation },
  { href: "/seats", label: "좌석 시야", icon: Armchair },
  { href: "/chat", label: "물어보기", icon: MessageCircle },
] as const;

export function BottomNav() {
  const path = usePathname();
  if (path.startsWith("/shows")) return null;
  return (
    <nav aria-label="주요 메뉴" className="fixed bottom-0 left-1/2 z-20 w-full max-w-[480px] -translate-x-1/2 border-t border-grey-100 bg-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <ul className="grid grid-cols-4">
        {TABS.map((t) => {
          const active = t.href === "/" ? path === "/" : path.startsWith(t.href);
          const I = t.icon;
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                // 3D 화면(약 260KB)은 누를 때만 받는다 — 데이터 요금 부담 줄이기
                prefetch={t.href === "/seats" ? false : undefined}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-[56px] flex-col items-center justify-center gap-1 text-[0.75rem] font-semibold ${active ? "text-ink" : "text-ink-3"}`}
              >
                <I size={23} strokeWidth={active ? 2.4 : 2} fill={active ? "currentColor" : "none"} fillOpacity={active ? 0.12 : 0} />
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
