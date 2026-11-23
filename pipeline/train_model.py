"""2025 올림픽공원 차량입출차·공연·날씨 연계 데이터(API_CPM_009) → 시간대별 주차 수요 모델

입력: pipeline/samples/linked_2025.json (fetch_api.py 결과, item 목록)
  DESCRIPTION 예) "주차대수:19,방문객:57, 기온:-3.4, 풍향:3.6, 강수량:, 습도:27,휴일:,공연명:,공연관람객수:0"
출력: pipeline/model_report.json (검증 지표·특성 중요도), pipeline/model.txt (LightGBM)
"""
from __future__ import annotations

import json
import re
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent
SRC = ROOT / "samples" / "linked_2025.json"


def parse_desc(s: str) -> dict:
    out = {}
    for part in re.split(r",\s*", s or ""):
        if ":" in part:
            k, v = part.split(":", 1)
            out[k.strip()] = v.strip()
    return out


def load() -> pd.DataFrame:
    rows = json.loads(SRC.read_text())
    recs = []
    for r in rows:
        d = parse_desc(r.get("DESCRIPTION") or r.get("description") or "")
        t = r.get("ISSUED_DATE") or r.get("issuedDate")
        recs.append({"time": t, **d})
    df = pd.DataFrame(recs)
    df["time"] = pd.to_datetime(df["time"], errors="coerce")
    num = {"주차대수": "cars", "방문객": "visitors", "기온": "temp", "풍향": "wind", "강수량": "rain", "습도": "humid", "공연관람객수": "audience"}
    for k, v in num.items():
        df[v] = pd.to_numeric(df.get(k), errors="coerce")
    df["rain"] = df["rain"].fillna(0)
    df["holiday"] = df.get("휴일", "").fillna("").astype(str).str.len().gt(0).astype(int)
    df["show"] = df.get("공연명", "").fillna("").astype(str)
    df = df.dropna(subset=["time", "cars"]).sort_values("time")
    df["hour"] = df.time.dt.hour
    df["dow"] = df.time.dt.dayofweek
    df["weekend"] = (df.dow >= 5).astype(int)
    df["month"] = df.time.dt.month
    df["has_show"] = (df.audience.fillna(0) > 0).astype(int)
    return df


def main():
    df = load()
    print(len(df), "rows", df.time.min(), "~", df.time.max())
    print(df[["cars", "visitors", "temp", "rain", "humid", "audience"]].describe().round(1))
    print("공연 있는 시간대", int(df.has_show.sum()), "공연명 예:", df.loc[df.show != "", "show"].unique()[:8])

    feats = ["hour", "dow", "weekend", "month", "holiday", "temp", "rain", "humid", "audience", "has_show"]
    X = df[feats].fillna(0)
    y = df["cars"]
    # 시간 순서 유지: 1~10월 학습, 11~12월 검증
    tr = df.month <= 10
    report = {"rows": int(len(df)), "period": [str(df.time.min()), str(df.time.max())], "features": feats}
    try:
        import lightgbm as lgb

        m = lgb.LGBMRegressor(n_estimators=400, learning_rate=0.05, num_leaves=31, min_child_samples=10, verbose=-1)
        m.fit(X[tr], y[tr])
        pred = m.predict(X[~tr])
        base = df[tr].groupby(["weekend", "hour"]).cars.mean()
        basepred = [base.get((w, h), y[tr].mean()) for w, h in zip(df.loc[~tr, "weekend"], df.loc[~tr, "hour"])]
        yt = y[~tr].values

        def mae(p):
            return float(np.mean(np.abs(yt - np.asarray(p))))

        def r2(p):
            return float(1 - np.sum((yt - np.asarray(p)) ** 2) / np.sum((yt - yt.mean()) ** 2))

        report.update(
            {
                "valid_rows": int((~tr).sum()),
                "mae_model": round(mae(pred), 1),
                "mae_baseline": round(mae(basepred), 1),
                "r2_model": round(r2(pred), 3),
                "r2_baseline": round(r2(basepred), 3),
                "importance": dict(sorted(zip(feats, map(int, m.feature_importances_)), key=lambda x: -x[1])),
            }
        )
        m.fit(X, y)
        m.booster_.save_model(str(ROOT / "model.txt"))
    except ImportError:
        report["error"] = "lightgbm 없음"
    (ROOT / "model_report.json").write_text(json.dumps(report, ensure_ascii=False, indent=1))
    print(json.dumps(report, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
