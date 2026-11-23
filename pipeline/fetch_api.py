"""공공데이터 API 수집 (GitHub Actions에서 실행 — 키는 Secrets로만 주입)

환경변수
  KEY_LINKED / URL_LINKED   : 올림픽공원 차량입출차·공연·날씨 연계 (15164822)
  KEY_INOUT  / URL_INOUT    : 올림픽공원 입출차정보 전체구역 (15159093)
  KEY_PERF   / URL_PERF     : 올림픽공원 공연정보 (3037877 / 15105195)
결과: pipeline/raw/api_<name>.json  (원본 item 목록), pipeline/raw/api_<name>_sample.json (앞 20건, 커밋용)
"""
from __future__ import annotations

import json
import os
import sys
import time
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

RAW = Path(__file__).resolve().parent / "raw"
RAW.mkdir(exist_ok=True)
DATASETS = ["LINKED", "INOUT", "PERF"]
MAX_PAGES = int(os.environ.get("MAX_PAGES", "3000"))
# 연계 데이터·공연정보는 건수가 적어 항상 전부 받음
FULL = {"LINKED", "PERF"}


def parse(body: bytes) -> tuple[list[dict], int | None]:
    text = body.decode("utf-8", errors="replace").strip()
    if text.startswith("{"):
        j = json.loads(text)
        b = j.get("response", {}).get("body", j)
        items = b.get("items", {})
        items = items.get("item", items) if isinstance(items, dict) else items
        if isinstance(items, dict):
            items = [items]
        return list(items or []), int(b.get("totalCount") or 0) or None
    root = ET.fromstring(text)
    items = [{c.tag: (c.text or "").strip() for c in it} for it in root.iter("item")]
    tc = root.findtext(".//totalCount")
    return items, int(tc) if tc and tc.isdigit() else None


def fetch(name: str) -> None:
    key, url = os.environ.get(f"KEY_{name}"), os.environ.get(f"URL_{name}")
    if not key or not url:
        print(f"[{name}] 키/URL 없음 — 건너뜀")
        return
    rows, page, per = [], 1, 1000
    limit = 100 if name in FULL else MAX_PAGES
    while page <= limit:
        q = urllib.parse.urlencode({"serviceKey": key, "pageNo": page, "numOfRows": per})
        sep = "&" if "?" in url else "?"
        with urllib.request.urlopen(f"{url}{sep}{q}", timeout=60) as r:
            body = r.read()
        if page == 1:
            (RAW / f"api_{name.lower()}_first_page.txt").write_bytes(body[:20000])
        items, total = parse(body)
        rows += items
        print(f"[{name}] page {page}: +{len(items)} (누적 {len(rows)}/{total})")
        if not items or (total and len(rows) >= total):
            break
        page += 1
        time.sleep(0.2)
    (RAW / f"api_{name.lower()}.json").write_text(json.dumps(rows, ensure_ascii=False))
    (RAW / f"api_{name.lower()}_sample.json").write_text(json.dumps(rows[:20], ensure_ascii=False, indent=1))


if __name__ == "__main__":
    for n in sys.argv[1:] or DATASETS:
        try:
            fetch(n)
        except Exception as e:  # 한 데이터셋 실패가 전체를 막지 않게
            print(f"[{n}] 실패: {e}")
