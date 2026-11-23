"""2024년 7월 올림픽공원 입출차(15138735) 분석 → 예측 보정값(calibration.json) + 기획서용 그림"""
import json
from pathlib import Path
import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent
df = pd.read_csv(ROOT / "raw/parking_inout_202407.csv", encoding="cp949")
df.columns = ["day", "tin", "tout"]
df["tin"] = pd.to_datetime(df.tin); df["tout"] = pd.to_datetime(df.tout)
df["dur"] = (df.tout - df.tin).dt.total_seconds() / 60
d = df[(df.dur >= 0) & (df.dur < 24 * 60)]

idx = pd.date_range("2024-07-01", "2024-08-01", freq="10min", inclusive="left")
ins = d.set_index("tin").resample("10min").size().reindex(idx, fill_value=0)
outs = d.set_index("tout").resample("10min").size().reindex(idx, fill_value=0)
occ = (ins - outs).cumsum()
occ = occ - occ.groupby(occ.index.date).transform(lambda s: s.iloc[:30].min()).clip(upper=0)  # 새벽 기준 보정

daily_peak = occ.groupby(occ.index.date).max()
med, mad = daily_peak.median(), (daily_peak - daily_peak.median()).abs().median()
event_days = [str(k) for k, v in daily_peak.items() if v > med + 6 * mad]

frame = pd.DataFrame({"occ": occ, "ins": ins, "outs": outs})
frame["date"] = frame.index.date.astype(str)
frame["hour"] = frame.index.hour
frame["slot"] = frame.index.hour * 6 + frame.index.minute // 10
frame["weekend"] = frame.index.dayofweek >= 5
normal = frame[~frame.date.isin(event_days)]
prof = normal.groupby(["weekend", "hour"]).occ.mean().round(0)

# 행사일: 출차 피크 이후 10분 단위 출차 대수 → 출차 처리량·소요시간
exit_curves = {}
for day in event_days:
    f = frame[frame.date == day]
    t0 = f.outs.idxmax()
    w = f.loc[t0 - pd.Timedelta("30min"): t0 + pd.Timedelta("90min"), "outs"]
    exit_curves[day] = {"peakAt": t0.strftime("%H:%M"), "per10min": w.tolist()}

cal = {
    "source": "한국체육산업개발_올림픽공원 입출차 정보(2024-07, 215,528건)",
    "records": int(len(df)),
    "dailyEntriesMean": int(d.groupby(d.tin.dt.date).size().mean()),
    "normalDailyPeakMedian": int(med),
    "maxConcurrent": int(occ.max()),
    "maxConcurrentAt": occ.idxmax().strftime("%Y-%m-%d %H:%M"),
    "eventDays": event_days,
    "eventDailyPeaks": {k: int(daily_peak[pd.Timestamp(k).date()]) for k in event_days},
    "maxExitPer10min": int(outs.max()),
    "exitThroughputPerHour": int(outs.max() * 6),
    "baseProfile": {
        "weekday": {int(h): int(v) for h, v in prof[False].items()},
        "weekend": {int(h): int(v) for h, v in prof[True].items()},
    },
    "exitCurves": exit_curves,
    "durationMedianMin": float(d.dur.median()),
}
(ROOT / "calibration.json").write_text(json.dumps(cal, ensure_ascii=False, indent=1))
print(json.dumps({k: v for k, v in cal.items() if k not in ("baseProfile",)}, ensure_ascii=False, indent=1))
print(prof.unstack(0))

# 기획서용 그림
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib import font_manager
for fp in ["/usr/share/fonts/truetype/nanum/NanumGothic.ttf", "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc", "/usr/share/fonts/opentype/noto/NotoSerifCJK-Regular.ttc"]:
    if Path(fp).exists():
        font_manager.fontManager.addfont(fp); plt.rcParams["font.family"] = font_manager.FontProperties(fname=fp).get_name(); break
fig, ax = plt.subplots(figsize=(9, 3.6), dpi=200)
hours = np.arange(0, 24, 1/6)
for day, color, lw, label in [(event_days[0] if event_days else None, "#1b64da", 2.2, None)] + []:
    pass
wk = frame[(~frame.date.isin(event_days)) & (~frame.weekend)].groupby("slot").occ.mean()
we = frame[(~frame.date.isin(event_days)) & (frame.weekend)].groupby("slot").occ.mean()
ax.plot(hours, wk.values, color="#b0b8c1", lw=1.6, label="평일 평균")
ax.plot(hours, we.values, color="#8b95a1", lw=1.6, label="주말 평균")
cols = ["#3182f6", "#1b64da", "#0b3d91"]
for i, day in enumerate(event_days[:3]):
    s = frame[frame.date == day].occ.values
    ax.plot(hours[: len(s)], s, color=cols[i % 3], lw=2.2, label=f"{day[5:].replace('-', '/')} (행사일)")
ax.set_xlim(0, 24); ax.set_xticks(range(0, 25, 3)); ax.set_xticklabels([f"{h}시" for h in range(0, 25, 3)])
ax.set_ylabel("동시 주차 대수")
ax.spines[["top", "right"]].set_visible(False); ax.grid(axis="y", color="#eef0f3")
ax.legend(frameon=False, fontsize=8, loc="upper left")
ax.set_title("올림픽공원 시간대별 동시 주차 대수 (2024년 7월)", loc="left", fontsize=11, fontweight="bold")
fig.tight_layout(); fig.savefig(ROOT / "fig_occupancy_202407.png")
