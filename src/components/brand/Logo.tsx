/** 함께 보는 무대 로고: 무대(아치) 아래 나란히 앉은 두 객석 — 그중 하나는 휠체어 자리 */
export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <rect width="32" height="32" rx="9" fill="#3182f6" />
      <path d="M7 17a9 9 0 0 1 18 0" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
      <rect x="9" y="20" width="5.5" height="5" rx="1.6" fill="#fff" />
      <circle cx="21" cy="22.5" r="2.7" fill="none" stroke="#fff" strokeWidth="2" />
      <circle cx="21" cy="19" r="1.2" fill="#fff" />
    </svg>
  );
}

export function Wordmark() {
  return (
    <span className="flex items-center gap-2">
      <LogoMark />
      <span className="text-[1.125rem] font-extrabold tracking-tight text-ink">함께 보는 무대</span>
    </span>
  );
}
