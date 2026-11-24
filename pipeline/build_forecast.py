"""함께 보는 무대 — 공원 혼잡 예측 배치.

- pipeline/raw/ 에 공공데이터 CSV가 있으면 LightGBM으로 시간대별 주차 수요를 학습해 예측
- 없으면 휴리스틱 베이스라인(샘플)으로 src/data/shows.json 생성

실행: python3 pipeline/build_forecast.py
"""
from __future__ import annotations

import json
import re
import math
import random
from datetime import date, datetime, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "pipeline" / "raw"
OUT = ROOT / "src" / "data" / "shows.json"

# 올림픽공원 공연장 공식 수용 인원 (올림픽공원 공연장 비교 안내 · 한국관광공사 시설 정보)
# 공연 규모가 따로 공개되지 않으므로 '매진(수용 인원만큼 관람)'으로 가정해 예측 입력에 쓴다.
VENUES = {
    "KSPO DOME": {"capacity": 15000},
    "티켓링크 라이브 아레나": {"capacity": 5000},  # SK핸드볼경기장
    "올림픽홀": {"capacity": 3000},
    "우리금융아트홀": {"capacity": 1184},
    "뮤즈라이브": {"capacity": 237},
    "K-아트홀": {"capacity": 493},
}
EVENTS = ROOT / "src" / "data" / "events.json"
LAT, LON = 37.5207, 127.1215  # 올림픽공원

SENIOR_KW = ["트로트", "조용필", "나훈아", "임영웅", "7080", "송가인", "영탁", "이찬원", "장윤정", "남진", "심수봉", "패티김", "포크", "가요무대", "진성", "주현미", "인순이", "최백호", "이문세", "양희은", "미스터트롯", "미스트롯", "현역가왕", "불타는 트롯", "손태진", "박지현", "이승철", "트롯"]
FAMILY_KW = ["뮤지컬", "최현우", "발레", "호두까기", "어린이", "가족", "키즈", "마술", "매직", "인형", "동화", "핑크퐁", "뽀로로", "오케스트라", "합창", "아이스"]


def audience_of(title: str, age: str) -> str:
    t = title or ""
    if any(k in t for k in SENIOR_KW):
        return "senior"
    if any(k in t for k in FAMILY_KW) or re.search(r"(\d+)\s*개월", age or ""):
        return "family"
    return "mz"


def genre_of(title: str) -> str:
    t = title or ""
    if "뮤지컬" in t:
        return "뮤지컬"
    if any(k in t for k in ["발레", "호두까기"]):
        return "무용"
    if any(k in t for k in ["마술", "매직"]) or "최현우" in t:
        return "마술"
    if any(k in t for k in ["오케스트라", "교향", "필하모닉", "클래식"]):
        return "클래식"
    return "대중음악"


def norm_venue(v: str) -> str | None:
    for k in VENUES:
        if k in (v or ""):
            return k
    if "핸드볼" in (v or ""):
        return "티켓링크 라이브 아레나"
    return None


def fetch_weather() -> dict:
    """Open-Meteo(무료·키 불필요) 16일 예보. 실패하면 빈 dict."""
    import urllib.request
    url = (f"https://api.open-meteo.com/v1/forecast?latitude={LAT}&longitude={LON}"
           "&daily=temperature_2m_mean,precipitation_sum,precipitation_probability_max,weather_code&timezone=Asia%2FSeoul&forecast_days=16")
    try:
        with urllib.request.urlopen(url, timeout=20) as r:
            d = json.loads(r.read())["daily"]
    except Exception as e:  # noqa
        print("weather fail", e)
        return {}
    out = {}
    for i, day in enumerate(d["time"]):
        code = d["weather_code"][i]
        rain = (d["precipitation_sum"][i] or 0) >= 1.0 or (d["precipitation_probability_max"][i] or 0) >= 60
        sky = "눈" if code in (71, 73, 75, 77, 85, 86) else "비" if rain or code >= 51 else "맑음" if code <= 1 else "구름많음" if code == 2 else "흐림"
        out[day] = {"temp": round(d["temperature_2m_mean"][i], 1), "sky": sky, "precip": bool(rain or sky in ("비", "눈")), "source": "Open-Meteo 예보"}
    return out


# 예보 범위 밖 날짜: 서울 월평균 기온(평년값), 강수 없음 가정
NORMAL_TEMP = {1: -1.9, 2: 0.7, 3: 6.1, 4: 12.6, 5: 18.2, 6: 22.4, 7: 25.3, 8: 26.1, 9: 21.6, 10: 15.0, 11: 7.5, 12: 0.2}


def runtime_of(s: str) -> int:
    m = re.search(r"(\d{2,3})\s*분", s or "")
    return int(m.group(1)) if m else 150

CAL = json.loads((ROOT / "pipeline" / "calibration.json").read_text())

# ── 아래 값들은 학습 모델 파일(model.txt)이 없을 때 쓰는 예시용 대체 계산에만 쓴다.
#    실제 서비스(공식 일정 + 학습 모델)는 쓰지 않으며 화면에도 나오지 않는다.
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
    day_aud = max(s["capacity"] for s in all_shows_that_day)  # 매진 가정
    w = show["weather"]
    rows, hours = [], list(range(8, 24))
    for h in hours:
        in_show = any(int(s["start"][:2]) <= h <= int(s["start"][:2]) + s["runtime"] // 60 for s in all_shows_that_day)
        rows.append([h, d.weekday(), int(d.weekday() >= 5), d.month, 0, w["temp"], 3.0 if w["precip"] else 0.0, 75 if w["precip"] else 50,
                     day_aud, max(-12, min(12, first_start - h)), int(in_show)])
    pred = booster.predict(rows)
    # 위쪽 범위(90% 분위수) — 하루 피크가 BUSY_DAY 이상이면 '붐빌 수 있는 날' (train_model.py 교차검증: 실제 혼잡일 11일 중 8일 사전 탐지)
    qpath = MODEL_PATH.with_name("model_q90.txt")
    upper = lgb.Booster(model_file=str(qpath)).predict(rows) if qpath.exists() else pred
    series = []
    for h, c, u in zip(hours, pred, upper):
        c = max(0.0, float(c))
        u = max(c, float(u))
        series.append({"h": h, "occ": min(100, round(c / FULL_CARS * 100)), "hi": min(100, round(u / FULL_CARS * 100)), "cars": round(c), "cars_raw": round(c), "hi_raw": u})
    return {"hours": series}


BUSY_DAY = 2800


def level(occ: int) -> str:
    if occ >= 95:
        return "만차"
    if occ >= 75:
        return "혼잡"
    if occ >= 50:
        return "보통"
    return "원활"


def recommendations(show: dict, hours: list[dict]) -> dict:
    """화면에 쓰는 값만: 혼잡 예측에서 바로 나오는 것 (가정이 필요한 출차 대기·게이트 추천은 넣지 않음)"""
    start_h = int(show["start"][:2]) + int(show["start"][3:]) / 60
    car_arrive = None
    for p in hours:
        if p["h"] + 1 <= start_h and p["occ"] < 85:
            car_arrive = p["h"]
    full_at = next((p["h"] for p in hours if p["occ"] >= 95), None)
    return {
        "carArrive": f"{car_arrive:02d}:00" if car_arrive is not None else None,
        "fullAt": f"{full_at:02d}:00" if full_at is not None else None,
        "busyDay": max(p.get("hi_raw", p["cars_raw"]) for p in hours) >= BUSY_DAY,
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
            p.pop("hi_raw", None)
        s["forecast"] = fc
    return shows


def build_real(today: date, days: int = 45) -> list[dict]:
    """올림픽공원 공식 일정안내(events.json)의 실제 공연 → 회차별 예측."""
    if not EVENTS.exists():
        return []
    evs = json.loads(EVENTS.read_text()).get("events", [])
    weather = fetch_weather()
    if not weather and OUT.exists():
        # 예보를 못 받으면 직전에 받아 둔 예보를 그대로 쓴다 (평년값으로 덮어쓰지 않음)
        for old in json.loads(OUT.read_text()).get("shows", []):
            if old.get("weather", {}).get("source") == "Open-Meteo 예보":
                weather.setdefault(old["date"], old["weather"])
    shows = []
    for e in evs:
        venue = norm_venue(e.get("venue", ""))
        if not venue:
            continue
        upcoming = [(k, v) for k, v in sorted((e.get("schedule") or {}).items()) if today <= date.fromisoformat(k) <= today + timedelta(days=days)]
        # 장기 공연(뮤지컬 등)은 목록을 덮지 않도록 가까운 3회차만
        for d_iso, start in upcoming[:3]:
            d = date.fromisoformat(d_iso)
            w = weather.get(d_iso) or {"temp": NORMAL_TEMP[d.month], "sky": None, "precip": False, "source": "평년값"}
            shows.append({
                "id": f"e{e['seq']}-{d.strftime('%m%d')}",
                "title": e["title"],
                "venue": venue,
                "date": d_iso,
                "start": start,
                "runtime": runtime_of(e.get("runtime", "")),
                "genre": genre_of(e["title"]),
                "audience": audience_of(e["title"], e.get("age", "")),
                "capacity": VENUES[venue]["capacity"],
                "weather": w,
                "official": {**{k: e.get(k, "") for k in ("url", "poster", "age", "price", "host", "contact", "time_text")}, "runDates": [e.get("start_date"), e.get("end_date")], "moreCount": max(0, len(upcoming) - 3)},
            })
    for s in shows:
        same_day = [x for x in shows if x["date"] == s["date"]]
        fc = model_forecast(s, same_day) if MODEL_PATH.exists() else heuristic_forecast(s, same_day)
        for p in fc["hours"]:
            p["level"] = level(p["occ"])
        s["reco"] = recommendations(s, fc["hours"])
        for p in fc["hours"]:
            p.pop("cars_raw", None)
            p.pop("hi_raw", None)
        s["forecast"] = fc
    return shows


def main() -> None:
    today = datetime.now(tz=__import__("zoneinfo").ZoneInfo("Asia/Seoul")).date()
    shows = build_real(today)
    source = "official"
    if not shows:
        shows, source = build_sample(), "sample"
    payload = {
        "generatedAt": datetime.now().isoformat(timespec="seconds"),
        "source": source,  # official = 올림픽공원 공식 일정안내, sample = 예시 공연
        "model": json.loads((ROOT / "pipeline" / "model_report.json").read_text()) if MODEL_PATH.exists() else None,
        "calibration": {k: CAL[k] for k in ("source", "records", "maxConcurrent", "exitThroughputPerHour", "normalDailyPeakMedian")},
        "shows": shows,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=1))
    print(f"wrote {OUT} ({len(shows)} shows)")
    for s in shows:
        peak = max(s["forecast"]["hours"], key=lambda p: p["occ"])
        print(s["date"], s["start"], s["audience"], s["venue"], "peak", peak["h"], peak["occ"], s["reco"]["carArrive"], "busy" if s["reco"]["busyDay"] else "")


if __name__ == "__main__":
    main()
