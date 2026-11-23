import { useId } from "react";

/**
 * 함께 보는 무대 로고: 무대 아치 아래 나란히 앉은 두 관객.
 * 한 사람은 서 있고(흰색) 한 사람은 앉아 있지만(노랑, 휠체어 이용자) 눈높이는 같다 — "같은 높이에서 함께 본다".
 */
export function LogoMark({ size = 28 }: { size?: number }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#4b97ff" />
          <stop offset="1" stopColor="#1b64da" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill={`url(#${id})`} />
      <path d="M7.4 26.2V15.6a8.6 8.6 0 0 1 17.2 0v10.6" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="12.9" cy="15.4" r="2.45" fill="#fff" />
      <circle cx="19.1" cy="15.4" r="2.45" fill="#ffd43b" />
      <path d="M9.9 26.2v-3.9a3 3 0 0 1 6 0v3.9z" fill="#fff" />
      <path d="M16.3 26.2v-2.4a2.8 2.8 0 0 1 5.6 0v2.4z" fill="#ffd43b" />
    </svg>
  );
}

export function Wordmark() {
  return (
    <span className="flex items-center gap-2">
      <LogoMark />
      <span className="text-[1.125rem] font-extrabold tracking-[-0.03em] text-ink">함께 보는 무대</span>
    </span>
  );
}
