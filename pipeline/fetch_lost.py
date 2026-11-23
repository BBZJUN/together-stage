"""한국체육산업개발 공식 유실물센터 게시판(습득 공고) 수집 → src/data/lost.json

게시판: https://www.ksponco.or.kr/board.es?mid=a10310000000&bid=0094
공고(시설·주차별)마다 상세 페이지의 표를 물품 목록으로 읽는다. 표가 없으면 본문 요약만 남긴다.
"""
import html, json, pathlib, re, sys, time, urllib.request

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from fetch_events import text, UA  # noqa: E402

BASE = "https://www.ksponco.or.kr"
LIST = BASE + "/board.es?mid=a10310000000&bid=0094&nPage={}"
VIEW = BASE + "/board.es?mid=a10310000000&bid=0094&act=view&list_no={}"
ROOT = pathlib.Path(__file__).resolve().parent.parent
RAW = ROOT / "pipeline" / "raw_events"
OUT = ROOT / "src" / "data" / "lost.json"
CENTER = {
    "name": "올림픽공원 유실물센터",
    "place": "우리금융아트홀 내 (서울 송파구 올림픽로 424)",
    "phone": ["02-2180-3564~5 (평화의 광장)", "02-2180-3566 (만남의 광장)"],
    "url": BASE + "/menu.es?mid=a10310000000",
}


def get(url):
    for i in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30) as r:
                return r.read().decode("utf-8", "replace")
        except Exception as e:  # noqa
            print("retry", url, e, file=sys.stderr)
            time.sleep(3 * (i + 1))
    return ""


def parse_list(page):
    out = []
    for m in re.finditer(r'list_no=(\d+)[^"\']*["\'][^>]*>(.*?)</a>', page, re.S):
        no, title = m.group(1), text(m.group(2)).replace("\n", " ").strip()
        if not title or any(o["no"] == int(no) for o in out):
            continue
        tail = page[m.end(): m.end() + 800]
        d = re.search(r"(20\d\d)[.\-](\d{2})[.\-](\d{2})", tail)
        out.append({"no": int(no), "title": title, "date": "-".join(d.groups()) if d else None})
    return out


def parse_view(page):
    items = []
    for tb in re.findall(r"<table.*?</table>", page, re.S | re.I):
        rows = re.findall(r"<tr.*?</tr>", tb, re.S | re.I)
        cells = [[text(c).replace("\n", " ").strip() for c in re.findall(r"<t[hd][^>]*>(.*?)</t[hd]>", r, re.S | re.I)] for r in rows]
        cells = [c for c in cells if any(c)]
        if len(cells) < 2:
            continue
        head = cells[0]
        # 게시판 메타 표(제목/작성자 등)는 건너뜀
        if any(h in "".join(head) for h in ("작성자", "조회수", "첨부파일")):
            continue
        for c in cells[1:]:
            if len(c) >= 2:
                items.append(dict(zip(head, c)) if len(c) == len(head) else {"내용": " · ".join(c)})
    body = re.search(r'class="[^"]*(view_cont|board_view|bbs_view|view_con)[^"]*"[^>]*>(.*?)</div>', page, re.S)
    summary = text(body.group(2))[:400] if body else ""
    return items, summary


def main():
    RAW.mkdir(parents=True, exist_ok=True)
    posts = []
    for p in (1, 2):
        page = get(LIST.format(p))
        if p == 1:
            (RAW / "lost_list.html").write_text(page[:300000])
        posts += [x for x in parse_list(page) if all(y["no"] != x["no"] for y in posts)]
        time.sleep(1)
    posts.sort(key=lambda x: -x["no"])
    print("공고", len(posts))
    out = []
    for i, ps in enumerate(posts[:16]):
        vp = get(VIEW.format(ps["no"]))
        if i == 0 and vp:
            (RAW / "lost_view.html").write_text(vp[:300000])
        items, summary = parse_view(vp) if vp else ([], "")
        out.append({**ps, "url": VIEW.format(ps["no"]), "items": items[:60], "summary": summary})
        time.sleep(1)
    if not out:
        print("수집 실패 — 기존 파일 유지")
        return
    OUT.write_text(json.dumps({"source": "official", "fetched_at": time.strftime("%Y-%m-%dT%H:%M:%S"), "center": CENTER, "notices": out}, ensure_ascii=False, indent=1))
    print(json.dumps(out[:2], ensure_ascii=False, indent=1)[:1500])


if __name__ == "__main__":
    main()
