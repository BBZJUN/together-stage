/** 유실물: 한국체육산업개발 공식 유실물센터 습득 공고(매일 수집). 예전 샘플 형식도 읽는다. */
import raw from "@/data/lost.json";

export interface LostItem {
  date: string;
  name: string;
  place: string;
  storage: string;
  url?: string;
  notice?: string;
}

type Notice = { no: number; title: string; date: string | null; url: string; items: Record<string, string>[]; lines?: string[]; summary: string };
type Data = {
  source: string;
  center?: { name: string; place: string; phone: string[]; url: string };
  notices?: Notice[];
  items?: LostItem[];
};
const data = raw as unknown as Data;

const pick = (o: Record<string, string>, keys: string[]) => {
  for (const k of Object.keys(o)) if (keys.some((x) => k.includes(x)) && o[k]) return o[k];
  return "";
};

export const lostSource = data.source;
export const lostCenter = data.center ?? {
  name: "올림픽공원 고객안내",
  place: "물건을 주운 시설의 안내데스크에 보관",
  phone: ["02-2180-3564~5 (고객안내전화)", "02-2180-3566 (고객안내전화)"],
  url: "https://www.ksponco.or.kr/menu.es?mid=a10310000000",
};

export function lostItems(): LostItem[] {
  if (data.items) return data.items;
  const out: LostItem[] = [];
  for (const n of data.notices ?? []) {
    if (n.items.length === 0 && n.lines?.length) {
      // 첨부 관리대장(HWP)에서 뽑은 줄: 물품명이 들어 있는 줄만
      for (const l of n.lines) {
        if (l.length < 2 || /^(연번|번호|습득일|습득장소|물품|보관|비고|처리|유실물|관리대장|순번)/.test(l) || /^\d+$/.test(l)) continue;
        out.push({ date: n.date ?? "", name: l, place: n.title.replace(/\s*\d+월.*$/, ""), storage: lostCenter.name, url: n.url, notice: n.title });
      }
      continue;
    }
    if (n.items.length === 0) {
      out.push({ date: n.date ?? "", name: n.title, place: "", storage: lostCenter.name, url: n.url, notice: n.title });
      continue;
    }
    for (const it of n.items) {
      out.push({
        date: (pick(it, ["접수일", "습득일", "일자", "날짜"]) || (n.date ?? "")).replace(/\.\s*/g, "-").replace(/-$/, ""),
        name: [pick(it, ["품명", "물품", "습득물", "내용", "분류"]), pick(it, ["형상", "특징"])].filter((x) => x && !/확인\s*가능/.test(x)).join(" · ") || Object.values(it).join(" "),
        place: [n.title.replace(/\s*\d+월.*$/, ""), pick(it, ["장소", "위치"])].filter(Boolean).join(" "),
        // 공고 머리말: "습득물을 보관하고 있으니 … 안내데스크에 문의" — 시설 안내데스크 보관
        storage: pick(it, ["보관"]) || `${n.title.replace(/\s*(\d{4}년\s*)?\d+월.*$/, "")} 안내데스크`,
        url: n.url,
        notice: n.title,
      });
    }
  }
  return out;
}

export function lostNotices() {
  return (data.notices ?? []).map((n) => ({ title: n.title, date: n.date, url: n.url, count: n.items.length }));
}
