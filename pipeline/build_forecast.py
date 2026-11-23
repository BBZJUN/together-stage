"""함께 보는 무대 — 공원 혼잡 예측 배치.

- pipeline/raw/ 에 공공데이터 CSV가 있으면 LightGBM으로 시간대별 주차 수요를 학습해 예측
- 없으면 휴리스틱 베이스라인(샘플)으로 src/data/shows.json 생성

실행: python3 pipeline/build_forecast.py
"""
from __future__ import annotations

import json
import math
import random
from datetime import date, datetime, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "pipeline" / "raw"
OUT = ROOT / "src" / "data" / "shows.json"

# 올림픽공원 주요 공연장 (좌석 규모는 대략치)
VENUES = {
    "KSPO DOME": {"capacity": 15000, "gate": "남2문"},
    "티켓링크 라이브 아레나": {"capacity": 6000, "gate": "남2문"},
    "올림픽홀": {"capacity": 3000, "gate": "동2문"},
    "우리금융아트홀": {"capacity": 1200, "gate": "북2문"},
}

CAL = json.loads((ROOT / "pipeline" / "calibration.json").read_text())

# 주차구역별 수용 대수 — 2024-07 관측 최대 동시주차 2,202대를 바탕으로 한 추정치
# (구역별 실제 비중은 입출차정보(전체구역) API의 주차구역 필드로 교체 예정)
GATES = {"동2문": 700, "남2문": 1000, "북2문": 600}
TOTAL_SPACES = sum(GATES.values())

# 관객 1인당 유발 차량 대수 — 2024-07-20·21 행사일 추가 주차(평소 대비 약 +1,270대)에 맞춰 보정한 뒤
# 세대별 자차 이용 경향을 반영해 배분 (기획서에 가정임을 명시)
CARS_PER_ATTENDEE = {"mz": 0.06, "family": 0.11, "senior": 0.13}
EXIT_THROUGHPUT = CAL["exitThroughputPerHour"]  # 관측 최대 출차 268대/10분 → 시간당 약 1,600대

SAMPLE_SHOWS = [
    # (일자 오프셋, 공연장, 제목, 장르, 관객세대, 시작, 러닝타임(분))
    (1, "KSPO DOME", "[샘플] K-POP 보이그룹 월드투어 서울", "대중음악", "mz", "19:00", 180),
    (2, "KSPO DOME", "[샘플] K-POP 보이그룹 월드투어 서울", "대중음악", "mz", "17:00", 180),
    (4, "올림픽홀", "[샘플] 인디밴드 연말 단독공연", "대중음악", "mz", "19:30", 120),
    (5, "KSPO DOME", "[샘플] 트로트 가수 전국투어 콘서트", "대중음악", "senior", "18:00", 150),
    (6, "KSPO DOME", "[샘플] 트로트 가수 전국투어 콘서트", "대중음악", "senior", "14:00", 150),
    (6, "우리금융아트홀", "[샘플] 가족 뮤지컬 〈겨울 숲 친구들〉", "뮤지컬", "family", "11:00", 90),
    (8, "티켓링크 라이브 아레나", "[샘플] 걸그룹 팬미팅", "대중음악", "mz", "18:00", 150),
    (11, "올림픽홀", "[샘플] 7080 포크 가요 콘서트", "대중음악", "senior", "15:00", 130),
    (12, "KSPO DOME", "[샘플] 발라드 가수 연말 콘서트", "대중음악", "family", "18:00", 170),
    (13, "KSPO DOME", "[샘플] 발라드 가수 연말 콘서트", "대중음악", "family", "17:00", 170),
    (13, "우리금융아트홀", "[샘플] 가족 뮤지컬 〈겨울 숲 친구들〉", "뮤지컬", "family", "14:00", 90),
]


def weather_for(d: date, rng: random.Random) -> dict:
    """기상청 단기예보 연동 전 샘플 날씨."""
    temp = round(rng.uniform(-6, 7), 1)
    rain = rng.random() < 0.25
    sky = ("눈" if temp < 0 else "비") if rain else rng.choice(["맑음", "구름많음", "흐림"])
    return {"temp": temp, "sky": sky, "precip": rain}


def base_park_load(hour: int, weekend: bool) -> float:
    """공연이 없는 날의 시간대별 평균 동시 주차 대수 (2024-07 실측, 행사일 제외)."""
    return float(CAL["baseProfile"]["weekend" if weekend else "weekday"][str(hour)])


def heuristic_forecast(show: dict, all_shows_that_day: list[dict]) -> dict:
    d = date.fromisoformat(show["date"])
    weekend = d.weekday() >= 5
    hours = list(range(8, 24))
    load = {h: base_park_load(h, weekend) for h in hours}

    for s in all_shows_that_day:
        cars = event_cars(s)
        start = int(s["start"][:2]) + int(s["start"][3:]) / 60
        end = start + s["runtime"] / 60
        # 실측: 행사일 주차는 시작 약 3~4시간 전부터 늘기 시작 → 시작 무렵 정점, 종료 후 1시간 내 대부분 출차
        lead = 2.0 if s["audience"] == "senior" else 1.5
        for h in hours:
            mid = h + 0.5
            if mid < start:
                arrived = 1 / (1 + math.exp(-(mid - (start - lead)) * 1.6))
            elif mid <= end:
                arrived = 1.0
            else:
                arrived = max(0.0, 1 - (mid - end) * 1.4)
            load[h] += cars * arrived

    series = []
    for h in hours:
        occ = min(100, round(load[h] / TOTAL_SPACES * 100))
        series.append({"h": h, "occ": occ, "cars": round(min(load[h], TOTAL_SPACES)), "cars_raw": round(load[h])})
    return {"hours": series}


def event_cars(s: dict) -> float:
    rain = 1.15 if s["weather"]["precip"] else 1.0
    return s["capacity"] * 0.92 * CARS_PER_ATTENDEE[s["audience"]] * rain


MODEL_PATH = ROOT / "pipeline" / "model.txt"
FULL_CARS = 4400  # 2025년 시간대별 주차대수 최대치(4,359대) 부근 = '가득 참' 기준


def model_forecast(show: dict, all_shows_that_day: list[dict]):
    """2025 연계 데이터로 학습한 LightGBM으로 시간대별 주차대수 예측"""
    import lightgbm as lgb

    booster = lgb.Booster(model_file=str(MODEL_PATH))
    d = date.fromisoformat(show["date"])
    first_start = min(int(s["start"][:2]) for s in all_shows_that_day)
    day_aud = max(s["capacity"] * 0.92 for s in all_shows_that_day)
    w = show["weather"]
    rows, hours = [], list(range(8, 24))
    for h in hours:
        in_show = any(int(s["start"][:2]) <= h <= int(s["start"][:2]) + s["runtime"] // 60 for s in all_shows_that_day)
        rows.append([h, d.weekday(), int(d.weekday() >= 5), d.month, 0, w["temp"], 3.0 if w["precip"] else 0.0, 75 if w["precip"] else 50,
                     day_aud, max(-12, min(12, first_start - h)), int(in_show)])
    pred = booster.predict(rows)
    series = []
    for h, c in zip(hours, pred):
        c = max(0.0, float(c))
        series.append({"h": h, "occ": min(100, round(c / FULL_CARS * 100)), "cars": round(c), "cars_raw": round(c)})
    return {"hours": series}


def level(occ: int) -> str:
    if occ >= 95:
        return "만차"
    if occ >= 75:
        return "혼잡"
    if occ >= 50:
        return "보통"
    return "원활"


def recommendations(show: dict, hours: list[dict]) -> dict:
    start_h = int(show["start"][:2]) + int(show["start"][3:]) / 60
    # 자차: 점유율 85% 넘기 전 시간대 중 공연 시작에 가장 가까운 시각
    car_arrive = None
    for p in hours:
        if p["h"] + 1 <= start_h and p["occ"] < 85:
            car_arrive = p["h"]
    full_at = next((p["h"] for p in hours if p["occ"] >= 95), None)

    cars = event_cars(show)
    # 공연 종료 직후 한꺼번에 나가려는 차량 = 이 공연 차량(수용량 상한) + 같은 시간대 일반 방문 차량의 일부
    end_h = min(23, int(start_h + show["runtime"] / 60))
    weekend = date.fromisoformat(show["date"]).weekday() >= 5
    parked = min(TOTAL_SPACES, cars + 0.3 * base_park_load(end_h, weekend))
    exits = []
    for leave in (0, 10, 20, 30, 45, 60):
        # 공연 종료 직후 출차 수요가 몰림: 남은 대기열 / 처리량 (대기열 중간 위치 기준 평균)
        queue = parked * max(0.0, 1 - leave / 70) ** 1.6
        wait = round(queue / EXIT_THROUGHPUT * 60 / 2)
        exits.append({"leaveMin": leave, "waitMin": wait})

    gate = VENUES[show["venue"]]["gate"]
    return {
        "carArrive": f"{car_arrive:02d}:00" if car_arrive is not None else None,
        "fullAt": f"{full_at:02d}:00" if full_at is not None else None,
        "transitTip": "공연 시작 1시간 전 올림픽공원역(5호선)·몽촌토성역(8호선) 승차 인원이 몰려요",
        "bestGate": gate,
        "exits": exits,
        "expectedCars": round(cars),
        "overflowCars": max(0, round(max(p["cars_raw"] for p in hours) - (FULL_CARS if MODEL_PATH.exists() else TOTAL_SPACES))),
    }


def build_sample() -> list[dict]:
    rng = random.Random(20261123)
    today = date(2026, 11, 23)
    shows = []
    for i, (off, venue, title, genre, aud, start, runtime) in enumerate(SAMPLE_SHOWS):
        d = today + timedelta(days=off)
        shows.append({
            "id": f"s{i+1:02d}",
            "title": title,
            "venue": venue,
            "date": d.isoformat(),
            "start": start,
            "runtime": runtime,
            "genre": genre,
            "audience": aud,
            "capacity": VENUES[venue]["capacity"],
        })
    weather_by_day = {}
    for s in shows:
        weather_by_day.setdefault(s["date"], weather_for(date.fromisoformat(s["date"]), rng))
        s["weather"] = weather_by_day[s["date"]]

    for s in shows:
        same_day = [x for x in shows if x["date"] == s["date"]]
        fc = model_forecast(s, same_day) if MODEL_PATH.exists() else heuristic_forecast(s, same_day)
        for p in fc["hours"]:
            p["level"] = level(p["occ"])
        s["reco"] = recommendations(s, fc["hours"])
        for p in fc["hours"]:
            p.pop("cars_raw", None)
        s["forecast"] = fc
    return shows


def main() -> None:
    has_raw = any(RAW.glob("*.csv"))
    if has_raw:
        # 실데이터 학습 경로는 train_model.py 에서 처리 (데이터 수령 후 구현)
        print("raw CSV 감지 — train_model.py 를 실행하세요. 지금은 샘플로 생성합니다.")
    shows = build_sample()
    payload = {
        "generatedAt": datetime.now().isoformat(timespec="seconds"),
        "source": "sample",  # 공연 목록은 샘플, 예측은 2025 연계 데이터 학습 모델
        "model": json.loads((ROOT / "pipeline" / "model_report.json").read_text()) if MODEL_PATH.exists() else None,
        "calibration": {k: CAL[k] for k in ("source", "records", "maxConcurrent", "exitThroughputPerHour", "normalDailyPeakMedian")},
        "gates": GATES,
        "shows": shows,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=1))
    print(f"wrote {OUT} ({len(shows)} shows)")
    for s in shows:
        peak = max(s["forecast"]["hours"], key=lambda p: p["occ"])
        print(s["date"], s["start"], s["audience"], s["venue"], "peak", peak["h"], peak["occ"], s["reco"]["carArrive"], s["reco"]["exits"][0])


if __name__ == "__main__":
    main()
