"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NEED_META, useNeeds } from "@/lib/mode";

export function Header() {
  const { needs } = useNeeds();
  const path = usePathname();
  if (path.startsWith("/shows")) return null; // 상세 화면은 자체 상단바 사용
  return (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between bg-bg px-5">
      <Link href="/" className="text-[1.25rem] font-extrabold tracking-tight text-ink">
        함께 보는 <span className="text-blue">무대</span>
      </Link>
      {needs && (
        <Link
          href="/?pick=1"
          aria-label="도움 유형 바꾸기"
          className="press rounded-full bg-grey-100 px-3 py-1.5 text-[0.8125rem] font-semibold text-ink-2"
        >
          {needs.length ? needs.map((n) => NEED_META[n].emoji).join(" ") : "도움 설정"}
        </Link>
      )}
    </header>
  );
}

const icons = {
  home: (
    <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1z" />
  ),
  route: <path d="M12 2a7 7 0 0 1 7 7c0 5.2-7 13-7 13S5 14.2 5 9a7 7 0 0 1 7-7zm0 4.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z" fillRule="evenodd" />,
  seat: <path d="M6 3h12a2 2 0 0 1 2 2v7H4V5a2 2 0 0 1 2-2zM3 13h18v3H3zm2 4h3v4H5zm11 0h3v4h-3z" />,
  chat: (
    <path d="M12 3c5 0 9 3.4 9 7.7s-4 7.7-9 7.7c-.9 0-1.8-.1-2.6-.3L5 20.5l1.1-3.8C4.2 15.3 3 13.1 3 10.7 3 6.4 7 3 12 3z" />
  ),
};

const TABS = [
  { href: "/", label: "홈", icon: icons.home },
  { href: "/route", label: "길찾기", icon: icons.route },
  { href: "/seats", label: "좌석 시야", icon: icons.seat },
  { href: "/chat", label: "물어보기", icon: icons.chat },
] as const;

export function BottomNav() {
  const path = usePathname();
  if (path.startsWith("/shows")) return null; // 상세 화면은 하단 CTA 사용
  return (
    <nav className="fixed bottom-0 left-1/2 z-20 w-full max-w-[480px] -translate-x-1/2 border-t border-grey-100 bg-bg pb-[env(safe-area-inset-bottom)]">
      <ul className="grid grid-cols-4">
        {TABS.map((t) => {
          const active = t.href === "/" ? path === "/" : path.startsWith(t.href);
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                className={`flex flex-col items-center gap-1 pb-2 pt-2.5 text-[0.6875rem] font-semibold ${
                  active ? "text-ink" : "text-grey-300"
                }`}
              >
                <svg aria-hidden width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  {t.icon}
                </svg>
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
