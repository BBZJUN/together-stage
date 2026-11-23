"""올림픽공원 공식 일정안내(ksponco.or.kr)에서 실제 공연 일정을 수집한다.

목록(텍스트보기) → 공연별 상세 페이지 → src/data/events.json
원본 HTML 일부는 pipeline/raw_events/ 에 남겨 파서 점검용으로 쓴다.
"""
import json, re, sys, time, pathlib, html
import urllib.request
from datetime import date
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from showtime import schedule  # noqa: E402

BASE = "https://www.ksponco.or.kr/olympicpark"
LIST = BASE + "/menu.es?mid=a20301010200"
LIST_AJAX = BASE + "/eventInfo/eventInfoListTextAjax.es"  # 공식 일정안내 화면이 쓰는 월별 목록(JSON)
VIEW = BASE + "/eventInfo/eventInfoView.es?mid=a20301010200&evtSeq={}"
ROOT = pathlib.Path(__file__).resolve().parent.parent
RAW = ROOT / "pipeline" / "raw_events"
OUT = ROOT / "src" / "data" / "events.json"
VENUES = ["KSPO DOME", "티켓링크 라이브 아레나", "올림픽홀", "뮤즈라이브", "우리금융아트홀", "K-아트홀", "SK올림픽핸드볼경기장", "핸드볼경기장", "88잔디마당", "평화의광장", "올림픽공원"]
UA = {"User-Agent": "Mozilla/5.0 (together-stage public-data contest; +https://together-stage.vercel.app)"}


def get(url, tries=3, body=None):
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers=UA, data=body)
            if body is not None:
                req.add_header("Content-Type", "application/json;charset=UTF-8")
                req.add_header("Referer", LIST)
            with urllib.request.urlopen(req, timeout=30) as r:
                return r.read().decode("utf-8", "replace")
        except Exception as e:  # noqa
            print("retry", url, e, file=sys.stderr)
            time.sleep(3 * (i + 1))
    return ""


def text(s):
    s = re.sub(r"(?is)<(script|style).*?</\1>", " ", s)
    s = re.sub(r"(?i)<br\s*/?>|</(p|li|tr|div|dd|dt|th|td|h\d)>", "\n", s)
    s = re.sub(r"<[^>]+>", " ", s)
    s = html.unescape(s)
    return "\n".join(re.sub(r"[ \t ]+", " ", l).strip() for l in s.splitlines() if l.strip())


def parse_list(page):
    """evtSeq 링크마다 주변 블록에서 제목·기간·장소를 뽑는다."""
    out = {}
    for m in re.finditer(r"evtSeq=(\d+)", page):
        seq = m.group(1)
        if seq in out:
            continue
        start = max(page.rfind("<li", 0, m.start()), page.rfind("<tr", 0, m.start()))
        end_li, end_tr = page.find("</li>", m.end()), page.find("</tr>", m.end())
        ends = [e for e in (end_li, end_tr) if e > 0]
        end = min(ends) if ends else m.end() + 1500
        block = text(page[start if start > 0 else m.start() - 800 : end])
        dates = re.findall(r"(20\d\d)[.\-/](\d{1,2})[.\-/](\d{1,2})", block)
        venue = next((v for v in VENUES if v in block), "")
        lines = [l for l in block.splitlines() if not re.search(r"20\d\d[.\-/]\d", l) and l not in VENUES and len(l) > 3]
        out[seq] = {"seq": int(seq), "title_list": lines[0] if lines else "", "dates": ["%s-%02d-%02d" % (y, int(mo), int(d)) for y, mo, d in dates][:2], "venue": venue}
    return out


FIELDS = ["공연명", "기간", "시간", "장소", "공연장", "티켓가격", "관람연령", "소요시간", "제작", "주최", "주관", "문의", "예매처"]


def parse_view(page):
    t = text(page)
    info = {}
    lines = t.splitlines()
    for i, l in enumerate(lines):
        for f in FIELDS:
            if l == f and i + 1 < len(lines):
                info.setdefault(f, lines[i + 1])
            elif l.startswith(f + " ") or l.startswith(f + ":") or l.startswith(f + " :"):
                info.setdefault(f, l[len(f):].lstrip(" :"))
    m = re.search(r'class="concert_title".*?<strong class="title">(.*?)</strong>', page, re.S)
    if m:
        info["제목"] = text(m.group(1))
    for k, v in re.findall(r"<li>\s*<em>([^<]+)</em>\s*<span[^>]*>(.*?)</span>", page, re.S):
        info[k.strip()] = text(v).replace("\n", " ")
    poster = re.search(r'(/olympicpark/attachFiles/eventInfo/[^"\']+\.(?:gif|jpg|jpeg|png))', page, re.I)
    if poster:
        info["poster"] = "https://www.ksponco.or.kr" + poster.group(1)
    return info


def month_list(ym: str):
    raw = get(LIST_AJAX, body=json.dumps({"nowYM": ym, "plcCd": ""}).encode())
    try:
        data = json.loads(raw)
    except Exception:  # noqa
        print("JSON 아님", ym, raw[:200], file=sys.stderr)
        return []
    rows = data[0] if isinstance(data, list) and data else []
    return rows


def main():
    RAW.mkdir(parents=True, exist_ok=True)
    today = date.today()
    items = {}
    for k in range(-1, 4):  # 지난달 ~ 3개월 뒤
        y, mo = today.year + (today.month - 1 + k) // 12, (today.month - 1 + k) % 12 + 1
        for r in month_list(f"{y}{mo:02d}"):
            seq = str(r.get("evtSeq"))
            items[seq] = {"seq": int(seq), "title_list": html.unescape(r.get("title", "")), "dates": [r.get("beginDt", ""), r.get("endDt", "")], "venue": r.get("plc", "")}
        time.sleep(0.8)
    if not items:  # 예비: 텍스트보기 HTML
        page = get(LIST)
        (RAW / "list.html").write_text(page[:400000])
        items = parse_list(page)
    print("목록", len(items))
    events, first = [], True
    for seq, it in sorted(items.items(), key=lambda x: -int(x[0])):
        vp = get(VIEW.format(seq))
        if first and vp:
            (RAW / "view_sample.html").write_text(vp[:400000]); first = False
        info = parse_view(vp) if vp else {}
        period = info.get("기간", "")
        dates = re.findall(r"(20\d\d)[.\-/](\d{1,2})[.\-/](\d{1,2})", period) or []
        dates = ["%s-%02d-%02d" % (y, int(mo), int(d)) for y, mo, d in dates] or [x.replace(".", "-") for x in it["dates"] if x]
        venue_raw = it["venue"] or info.get("장소", "") or info.get("공연장", "")
        venue = next((v for v in VENUES if v in venue_raw), venue_raw)
        sched = schedule(info.get("시간", ""), date.fromisoformat(dates[0]), date.fromisoformat(dates[-1])) if dates else {}
        events.append({
            "seq": int(seq),
            "title": it["title_list"] or info.get("제목") or info.get("공연명", ""),
            "venue": venue,
            "start_date": dates[0] if dates else None,
            "end_date": dates[-1] if dates else None,
            "schedule": sched,
            "time_text": info.get("시간", ""),
            "age": info.get("관람연령", ""),
            "runtime": info.get("소요시간", ""),
            "price": info.get("티켓가격", ""),
            "host": info.get("주최", ""),
            "contact": info.get("문의", ""),
            "poster": info.get("poster", ""),
            "url": VIEW.format(seq),
        })
        time.sleep(1.0)
    events.sort(key=lambda e: (e["start_date"] or "", e["seq"]))
    OUT.write_text(json.dumps({"source": "올림픽공원 공식 일정안내 (ksponco.or.kr)", "fetched_at": time.strftime("%Y-%m-%dT%H:%M:%S%z"), "events": events}, ensure_ascii=False, indent=1))
    print(json.dumps(events[:3], ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
