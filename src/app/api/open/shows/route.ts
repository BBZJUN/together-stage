import shows from "@/data/shows.json";

/** 가공 데이터 재공개: 공연 회차별 시간대 혼잡 예측 (CSV) */
export function GET() {
  const d = shows as unknown as {
    generatedAt: string;
    shows: { id: string; title: string; venue: string; date: string; start: string; forecast: { hours: { h: number; occ: number; hi?: number; cars: number; level: string }[] } }[];
  };
  const head = ["회차ID", "공연명", "공연장", "공연일", "시작", "시각(시)", "예상주차대수", "예상혼잡도(%)", "붐빌때_혼잡도(%)", "단계"];
  const rows = d.shows.flatMap((s) => s.forecast.hours.map((h) => [s.id, `"${s.title.replace(/"/g, '""')}"`, s.venue, s.date, s.start, h.h, h.cars, h.occ, h.hi ?? h.occ, h.level]));
  const csv = "﻿" + [head, ...rows].map((r) => r.join(",")).join("\n");
  return new Response(csv, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="olympicpark_show_crowd_forecast.csv"' },
  });
}
