"use client";

import { useEffect } from "react";
import { WifiOff } from "lucide-react";
import { useOnline } from "@/lib/offline";

/** 서비스워커 등록 + 오프라인일 때 안내 띠 */
export default function Offline() {
  const online = useOnline();
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  if (online) return null;
  return (
    <div role="status" className="flex items-center gap-2 bg-ink px-4 py-2.5 text-[0.875rem] font-semibold text-white">
      <WifiOff size={16} aria-hidden />
      인터넷이 끊겼어요. 저장한 길 안내와 보여주기 카드는 그대로 쓸 수 있어요.
    </div>
  );
}
