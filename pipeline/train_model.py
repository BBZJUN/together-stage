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
        # 공연명·관람객수는 TITLE에, 나머지는 DESCRIPTION에 들어 있음
        d = parse_desc((r.get("DESCRIPTION") or "") + "," + (r.get("TITLE") or ""))
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
    # 그날 공연 규모(최대 관람객)와 그날 첫 공연 시각까지 남은 시간
    df["date"] = df.time.dt.date
    day_aud = df.groupby("date").audience.max().rename("day_audience")
    first = df[df.has_show == 1].groupby("date").hour.min().rename("show_hour")
    df = df.join(day_aud, on="date").join(first, on="date")
    df["day_audience"] = df["day_audience"].fillna(0)
    df["to_show"] = (df["show_hour"] - df["hour"]).fillna(-99).clip(-12, 12)
    return df


def main():
    df = load()
    print(len(df), "rows", df.time.min(), "~", df.time.max())
    print(df[["cars", "visitors", "temp", "rain", "humid", "audience"]].describe().round(1))
    print("공연 있는 시간대", int(df.has_show.sum()), "공연명 예:", df.loc[df.show != "", "show"].unique()[:8])

    feats = ["hour", "dow", "weekend", "month", "holiday", "temp", "rain", "humid", "day_audience", "to_show", "has_show"]
    # 품질 점검: 11~12월은 시간대가 절반가량 비고, 값이 1씩 증감하는 인위적 구간이 섞여 있어 제외
    clean = df[df.month <= 10].copy()
    report = {
        "rows_total": int(len(df)),
        "rows_used": int(len(clean)),
        "excluded": "2025-11~12 (결측·인위적 증감 구간)",
        "period": [str(clean.time.min()), str(clean.time.max())],
        "features": feats,
        "show_day_count": int(clean[clean.has_show == 1].date.nunique()),
    }
    X = clean[feats].fillna(0)
    y = clean["cars"].values
    import lightgbm as lgb
    from sklearn.model_selection import GroupKFold

    folds = GroupKFold(n_splits=5)
    pred = np.zeros(len(y))
    basepred = np.zeros(len(y))
    weeks = clean.time.dt.isocalendar().week.astype(int).values
    for tr, te in folds.split(X, y, groups=weeks):
        m = lgb.LGBMRegressor(n_estimators=500, learning_rate=0.04, num_leaves=31, min_child_samples=15, subsample=0.9, subsample_freq=1, colsample_bytree=0.9, verbose=-1)
        m.fit(X.iloc[tr], y[tr])
        pred[te] = m.predict(X.iloc[te])
        b = clean.iloc[tr].groupby(["weekend", "hour"]).cars.mean()
        basepred[te] = [b.get((w, h), y[tr].mean()) for w, h in zip(clean.iloc[te].weekend, clean.iloc[te].hour)]

    def mae(p, mask=None):
        mk = np.ones(len(y), bool) if mask is None else mask
        return round(float(np.mean(np.abs(y[mk] - p[mk]))), 1)

    def r2(p, mask=None):
        mk = np.ones(len(y), bool) if mask is None else mask
        return round(float(1 - np.sum((y[mk] - p[mk]) ** 2) / np.sum((y[mk] - y[mk].mean()) ** 2)), 3)

    showday = (clean.day_audience > 0).values
    report.update(
        {
            "cv": "주 단위 5-겹 교차검증 (같은 주는 학습·검증에 동시에 들어가지 않음)",
            "all": {"mae_model": mae(pred), "mae_baseline": mae(basepred), "r2_model": r2(pred), "r2_baseline": r2(basepred)},
            "show_days": {"mae_model": mae(pred, showday), "mae_baseline": mae(basepred, showday), "r2_model": r2(pred, showday), "r2_baseline": r2(basepred, showday)},
        }
    )
    m = lgb.LGBMRegressor(n_estimators=500, learning_rate=0.04, num_leaves=31, min_child_samples=15, subsample=0.9, subsample_freq=1, colsample_bytree=0.9, verbose=-1)
    m.fit(X, y)
    report["importance"] = dict(sorted(zip(feats, map(int, m.feature_importances_)), key=lambda x: -x[1]))
    m.booster_.save_model(str(ROOT / "model.txt"))
    clean.assign(pred=pred, base=basepred).to_csv(ROOT / "cv_predictions.csv", index=False)
    (ROOT / "model_report.json").write_text(json.dumps(report, ensure_ascii=False, indent=1))
    print(json.dumps(report, ensure_ascii=False, indent=1))


if __name__ == "__main__" and "--validation" not in __import__("sys").argv:
    main()


def export_validation():
    """2025 실제 공연일 중 관람객이 많은 날: 실제 vs 교차검증 예측 (앱·기획서용)"""
    cv = pd.read_csv(ROOT / "cv_predictions.csv", parse_dates=["time"])
    cv["date"] = cv.time.dt.date.astype(str)
    shows = cv[cv.audience > 0].groupby("date").agg(show=("show", "first"), aud=("audience", "max")).sort_values("aud", ascending=False)
    days = []
    for date, row in shows.head(40).iterrows():
        d = cv[cv.date == date].sort_values("time")
        if len(d) < 20:
            continue
        days.append(
            {
                "date": date,
                "show": row.show,
                "audience": int(row.aud),
                "hours": [int(h) for h in d.time.dt.hour],
                "actual": [int(v) for v in d.cars],
                "pred": [int(round(v)) for v in d.pred],
                "base": [int(round(v)) for v in d.base],
                "mae": round(float(np.mean(np.abs(d.cars - d.pred))), 1),
            }
        )
        if len(days) >= 6:
            break
    rep = json.loads((ROOT / "model_report.json").read_text())
    out = {"report": rep, "days": days}
    (ROOT.parent / "src" / "data" / "validation.json").write_text(json.dumps(out, ensure_ascii=False))
    for d in days:
        print(d["date"], d["show"][:30], d["audience"], "MAE", d["mae"], "peak actual", max(d["actual"]), "pred", max(d["pred"]))


if __name__ == "__main__" and "--validation" in __import__("sys").argv:
    export_validation()
