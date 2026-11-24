"use client";
/** 오프라인 저장: 저장한 길·내 자리, 서비스워커에 화면 저장 요청, 온라인 상태 */
import { useSyncExternalStore } from "react";

const ROUTE_KEY = "together-saved-route";
const SEAT_KEY = "together-my-seat";

export interface SavedRoute {
  destId: string;
  origin: { kind: "station" | "parking"; id: string };
  rain: boolean;
  wheel: boolean | null;
  label: string;
  savedAt: string;
}
export interface MySeat {
  id: string;
  label: string;
  ratioSeated: number;
  ratioStanding: number;
  dist: number;
  wheelchair: boolean;
  savedAt: string;
}

function read<T>(k: string): T | null {
  try {
    const v = localStorage.getItem(k);
    return v ? (JSON.parse(v) as T) : null;
  } catch {
    return null;
  }
}
function write(k: string, v: unknown) {
  try {
    localStorage.setItem(k, JSON.stringify(v));
    window.dispatchEvent(new Event("together-storage"));
  } catch {
    /* 저장 불가 */
  }
}

export const loadRoute = () => read<SavedRoute>(ROUTE_KEY);
export const saveRoute = (r: SavedRoute) => write(ROUTE_KEY, r);
export const loadSeat = () => read<MySeat>(SEAT_KEY);
export const saveSeat = (s: MySeat) => write(SEAT_KEY, s);

/** 저장된 값이 바뀌면 다시 그리기 */
function subStorage(cb: () => void) {
  window.addEventListener("together-storage", cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener("together-storage", cb);
    window.removeEventListener("storage", cb);
  };
}
export function useSaved<T>(key: "route" | "seat"): T | null {
  const k = key === "route" ? ROUTE_KEY : SEAT_KEY;
  const raw = useSyncExternalStore(
    subStorage,
    () => {
      try {
        return localStorage.getItem(k);
      } catch {
        return null;
      }
    },
    () => null,
  );
  try {
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function useOnline() {
  return useSyncExternalStore(
    (cb) => {
      window.addEventListener("online", cb);
      window.addEventListener("offline", cb);
      return () => {
        window.removeEventListener("online", cb);
        window.removeEventListener("offline", cb);
      };
    },
    () => navigator.onLine,
    () => true,
  );
}

/** 서비스워커에 화면 저장 요청 → 저장된 개수 */
export function cacheForOffline(urls: string[]): Promise<number> {
  return new Promise((resolve) => {
    const sw = navigator.serviceWorker?.controller;
    if (!sw) return resolve(0);
    const onMsg = (e: MessageEvent) => {
      if (e.data?.type !== "cached") return;
      navigator.serviceWorker.removeEventListener("message", onMsg);
      resolve(e.data.ok as number);
    };
    navigator.serviceWorker.addEventListener("message", onMsg);
    sw.postMessage({ type: "cache-urls", urls });
    setTimeout(() => resolve(0), 8000);
  });
}
