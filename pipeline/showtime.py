"""공연 '시간' 자유 서술 → 날짜별 시작 시각.

예) "토 오후 6시 / 일 오후 5시", "2026년 11월 27일(금) 오후 7시 ...", "11월 13일 금 7PM(KST)",
    "수목금 19시 30분 / 토 15시, 19시 / 일 14시", "2026.11.21.(SAT) 6PM"
"""
import re
from datetime import date, timedelta

WD = {"월": 0, "화": 1, "수": 2, "목": 3, "금": 4, "토": 5, "일": 6,
      "MON": 0, "TUE": 1, "WED": 2, "THU": 3, "FRI": 4, "SAT": 5, "SUN": 6}
TIME = re.compile(
    r"(?P<ampm>오전|오후)?\s*(?P<h>\d{1,2})\s*(?:시\s*(?:(?P<m1>\d{1,2})\s*분|(?P<half>반))?|:(?P<m2>\d{2})|\s*(?P<pm>PM|pm|AM|am))"
)
DATE = re.compile(r"(?:(?P<y>20\d\d)\s*[년.\-/]\s*)?(?P<mo>\d{1,2})\s*[월.\-/]\s*(?P<d>\d{1,2})\s*일?")
WDAY = re.compile(r"(?<![가-힣\d])([월화수목금토일]{1,7})(?=[\s)\]/,·:]|요일|$|\d)|\b(MON|TUE|WED|THU|FRI|SAT|SUN)\b", re.I)


def _time(m) -> str | None:
    h = int(m.group("h"))
    mi = int(m.group("m1") or m.group("m2") or (30 if m.group("half") else 0))
    ap = (m.group("ampm") or "") + (m.group("pm") or "").upper()
    if ("오후" in ap or "PM" in ap) and h < 12:
        h += 12
    if not ap and 1 <= h <= 9:  # "7시" 처럼 오전/오후 없이 쓴 저녁 공연
        h += 12
    if not (9 <= h <= 23) or mi > 59:
        return None
    return f"{h:02d}:{mi:02d}"


def schedule(text: str, start: date, end: date) -> dict[str, str]:
    """{YYYY-MM-DD: 'HH:MM'} — 시간을 확정할 수 없는 날은 빠진다."""
    text = (text or "").replace("（", "(").replace("）", ")")
    text = re.sub(r"\(KST\)", "", text)
    by_date: dict[date, str] = {}
    by_wd: dict[int, str] = {}
    loose: list[str] = []
    anchor_dates: list[date] = []
    anchor_wds: list[int] = []
    pos = 0
    tokens = []
    for m in DATE.finditer(text):
        tokens.append((m.start(), "date", m))
    for m in WDAY.finditer(text):
        tokens.append((m.start(), "wd", m))
    for m in TIME.finditer(text):
        tokens.append((m.start(), "time", m))
    tokens.sort(key=lambda t: t[0])
    used_since_anchor = False
    last_date_end, last_date_val = -10, None
    for p, kind, m in tokens:
        # 같은 위치에서 날짜 숫자가 시간으로도 잡히는 것 방지
        if kind == "time" and any(k == "date" and q <= p < mm.end() for q, k, mm in tokens):
            continue
        if kind == "date":
            mo, d = int(m.group("mo")), int(m.group("d"))
            y = int(m.group("y")) if m.group("y") else start.year
            try:
                dt = date(y, mo, d)
            except ValueError:
                continue
            if dt < start and not m.group("y"):
                try:
                    dt = date(y + 1, mo, d)
                except ValueError:
                    pass
            if used_since_anchor:
                anchor_dates, anchor_wds, used_since_anchor = [], [], False
            last_date_end, last_date_val = m.end(), dt
            if start <= dt <= end:
                anchor_dates.append(dt)
        elif kind == "wd":
            s = (m.group(1) or m.group(2) or "").upper()
            wds = [WD[s]] if s in WD else [WD[c] for c in s if c in WD]
            # "11월 27일(금)" 처럼 날짜 바로 뒤 요일은 설명일 뿐 — 날짜가 기간 밖(오타)일 때만 요일로 사용
            if 0 <= p - last_date_end <= 3:
                if last_date_val and start <= last_date_val <= end:
                    continue
            if used_since_anchor:
                anchor_dates, anchor_wds, used_since_anchor = [], [], False
            anchor_wds.extend(wds)
        else:
            t = _time(m)
            if not t:
                continue
            used_since_anchor = True
            if anchor_dates and not anchor_wds:
                for dt in anchor_dates:
                    by_date.setdefault(dt, t)
            if anchor_wds:
                for w in anchor_wds:
                    by_wd.setdefault(w, t)
            if not anchor_dates and not anchor_wds:
                loose.append(t)
    out = {}
    d = start
    while d <= end:
        t = by_date.get(d) or by_wd.get(d.weekday())
        if not t and not by_date and not by_wd and loose:
            t = loose[0]
        if t:
            out[d.isoformat()] = t
        d += timedelta(days=1)
    return out
