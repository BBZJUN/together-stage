"""기관용 인사이트 (src/data/insight.json)

1) 공연별 관람객 1,000명당 추가 차량 (2025 연계 데이터)
2) 공연장 주변 이동 취약 구간 (OSM: 계단·고르지 않은 바닥, 공연장 300m 이내)
3) 데이터 품질 점검 결과
"""
from __future__ import annotations

import json
import math
import re
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))
import train_model as tm  # noqa: E402

out: dict = {}

# 1) 공연별 차량 유입
df = tm.load()
clean = df[df.month <= 10].copy()
base = clean[clean.day_audience == 0].groupby(["weekend", "month", "hour"]).cars.median()
clean["base"] = [base.get((w, m, h), np.nan) for w, m, h in zip(clean.weekend, clean.month, clean.hour)]
clean["excess"] = clean.cars - clean.base
g = clean[clean.day_audience > 0].groupby("date").agg(
    show=("show", lambda x: next((v for v in x if v), "")), aud=("day_audience", "max"), peak=("cars", "max"), exc=("excess", "max")
)
g = g[(g.aud >= 8000) & g.exc.notna()].copy()
g["per1k"] = (g.exc.clip(lower=0) / g.aud * 1000).round(1)
g = g.sort_values("per1k", ascending=False)
out["cars_per_1k"] = {
    "note": "관람객 8천 명 이상 공연일, 같은 월·요일유형·시간대의 공연 없는 날 중앙값 대비 최대 초과 주차대수 / 관람객 1,000명",
    "days": int(len(g)),
    "median": float(g.per1k.median()),
    "top": [{"date": str(d), "show": r.show, "audience": int(r.aud), "per1k": float(r.per1k)} for d, r in g.head(5).iterrows()],
    "bottom": [{"date": str(d), "show": r.show, "audience": int(r.aud), "per1k": float(r.per1k)} for d, r in g.tail(5).iloc[::-1].iterrows()],
}

# 2) 공연장 주변 이동 취약 구간
walk = json.loads((ROOT.parent / "src" / "data" / "walk.json").read_text())
venues = [p for p in walk["places"] if p["kind"] == "venue"]
near = []
for v in venues:
    steps = rough = 0
    rough_m = 0.0
    for w in walk["ways"]:
        if not (w["f"] & 3):
            continue
        if min(math.hypot(x - v["x"], y - v["y"]) for x, y in w["p"]) > 300:
            continue
        length = sum(math.hypot(a[0] - b[0], a[1] - b[1]) for a, b in zip(w["p"], w["p"][1:]))
        if w["f"] & 1:
            steps += 1
        if w["f"] & 2:
            rough += 1
            rough_m += length
    near.append({"venue": v["name"], "steps": steps, "rough": rough, "rough_m": round(rough_m)})
exits = [p for p in walk["places"] if p["kind"] == "exit"]
out["mobility"] = {
    "venues": sorted(near, key=lambda x: -(x["steps"] * 100 + x["rough_m"])),
    "exits_total": len(exits),
    "exits_wheel_yes": sum(1 for e in exits if e.get("wheelchair") == "yes"),
    "exits_wheel_no": sum(1 for e in exits if e.get("wheelchair") == "no"),
    "exits_unknown": sum(1 for e in exits if e.get("wheelchair") not in ("yes", "no")),
    "toilets": sum(1 for p in walk["places"] if p["kind"] == "toilet"),
    "toilets_wheel": sum(1 for p in walk["places"] if p["kind"] == "toilet" and p.get("wheelchair") == "yes"),
}

# 3) 데이터 품질
perf = json.loads((ROOT / "samples" / "perf_all.json").read_text())
kspo_names = {
    (r.get("spatial") or "").strip()
    for r in perf
    if re.search(r"체조|KSPO|kspo|Kspo", r.get("spatial") or "") and not re.search(r"[,/·]|핸드볼|잔디|홀", r.get("spatial") or "")
}
no_date = sum(1 for r in perf if not re.search(r"20\d\d[.\-/]\s?\d", (r.get("temporalCoverage") or "") + (r.get("title") or "")))
dec = df[df.month >= 11]
out["quality"] = [
    {
        "dataset": "올림픽공원 2025 차량입출차·공연·날씨 연계",
        "issue": f"11~12월은 {len(dec):,}시간만 있어 시간대가 절반가량 비고, 값이 정확히 1씩 증감하는 구간이 섞여 있음",
        "impact": "학습에서 제외 → 겨울철 예측 정확도 저하",
    },
    {
        "dataset": "올림픽공원 공연정보",
        "issue": f"전체 {len(perf):,}건 중 {no_date:,}건에 공연 날짜가 없음(시간만 있거나 자유 서식)",
        "impact": "다가오는 공연 일정 자동 연동 불가",
    },
    {
        "dataset": "올림픽공원 공연정보",
        "issue": f"KSPO DOME 한 곳이 {len(kspo_names)}가지 이름으로 기록됨 (예: {', '.join(sorted(kspo_names)[:3])})",
        "impact": "공연장별 집계·검색 시 누락",
    },
]
(ROOT.parent / "src" / "data" / "insight.json").write_text(json.dumps(out, ensure_ascii=False, indent=1))
print(json.dumps(out, ensure_ascii=False, indent=1)[:2500])
