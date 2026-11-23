"""OSM 올림픽공원 보행 네트워크 → 길찾기 그래프 (src/data/walk.json)

엣지 플래그(비트)
  1  계단            2  미끄럽거나 울퉁불퉁한 바닥(자갈·흙·나무데크·박석)
  4  차가 다니는 길    8  지붕·실내 통로
  16 휠체어 불가 표시  32 경사 표시(incline)
"""
from __future__ import annotations

import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "pipeline" / "samples" / "osm_olpark.json"
OUT = ROOT / "src" / "data" / "walk.json"

LAT0, LON0 = 37.5185, 127.1215  # 투영 기준점 (공원 중앙 부근)
MY = 111_320.0
MX = 111_320.0 * math.cos(math.radians(LAT0))


def xy(lat: float, lon: float) -> tuple[float, float]:
    return round((lon - LON0) * MX, 1), round(-(lat - LAT0) * MY, 1)  # y는 화면 아래 방향


WALK = {"footway", "path", "pedestrian", "steps", "service", "living_street", "cycleway", "track", "residential", "unclassified", "corridor"}
ROAD = {"service", "residential", "unclassified", "tertiary", "secondary", "living_street"}
ROUGH = {"cobblestone", "sett", "ground", "dirt", "gravel", "fine_gravel", "wood", "compacted", "unpaved", "grass", "pebblestone"}

VENUES = {
    "올림픽체조경기장": ("kspo", "KSPO DOME"),
    "SK올림픽핸드볼경기장": ("handball", "티켓링크 라이브 아레나"),
    "올림픽홀": ("olympichall", "올림픽홀"),
    "우리금융아트홀": ("artHall", "우리금융아트홀"),
}

# 출구 묶음 → 역 이름 (역 중심 근사 좌표로 가장 가까운 역 지정)
STATIONS = {
    "몽촌토성역 (8호선)": (37.5173, 127.1126),
    "한성백제역 (9호선)": (37.5163, 127.1160),
    "올림픽공원역 (5·9호선)": (37.5163, 127.1308),
}

d = json.loads(SRC.read_text())
els = d["elements"]

nodes: dict[int, tuple[float, float]] = {}
edges: list[tuple[int, int, float, int]] = []
draw_ways: list[dict] = []
buildings: list[dict] = []
places: list[dict] = []


def hav(a, b):
    return math.hypot(a[0] - b[0], a[1] - b[1])


for e in els:
    t = e.get("tags", {})
    if e["type"] != "way":
        continue
    geom = e.get("geometry") or []
    if "highway" in t and t["highway"] in WALK | ROAD and t.get("access") != "private" and t.get("foot") != "no":
        hw = t["highway"]
        flags = 0
        if hw == "steps":
            flags |= 1
        if t.get("surface") in ROUGH:
            flags |= 2
        if hw in ROAD:
            flags |= 4
        if t.get("covered") == "yes" or t.get("tunnel") in ("yes", "building_passage") or t.get("indoor") == "yes":
            flags |= 8
        if t.get("wheelchair") == "no":
            flags |= 16
        if "incline" in t:
            flags |= 32
        ids = e["nodes"]
        for nid, g in zip(ids, geom):
            nodes[nid] = xy(g["lat"], g["lon"])
        for a, b in zip(ids, ids[1:]):
            edges.append((a, b, hav(nodes[a], nodes[b]), flags))
        draw_ways.append({"f": flags, "p": [nodes[n] for n in ids]})
    elif "building" in t and geom:
        pts = [xy(g["lat"], g["lon"]) for g in geom]
        cx = sum(p[0] for p in pts) / len(pts)
        cy = sum(p[1] for p in pts) / len(pts)
        if abs(cx) > 1100 or abs(cy) > 700:
            continue
        name = t.get("name")
        v = VENUES.get(name or "")
        buildings.append({"p": pts, "name": name if v or (name and "아파트" not in name and not name[0].isdigit()) else None, "venue": v[0] if v else None})
        if v:
            places.append({"id": v[0], "kind": "venue", "name": v[1], "osmName": name, "x": round(cx, 1), "y": round(cy, 1), "poly": pts})
    elif t.get("amenity") == "parking" and geom:
        pts = [xy(g["lat"], g["lon"]) for g in geom]
        cx = sum(p[0] for p in pts) / len(pts)
        cy = sum(p[1] for p in pts) / len(pts)
        name = t.get("name") or ""
        if "올림픽공원" in name:
            places.append({"id": f"park{e['id']}", "kind": "parking", "name": name.replace("올림픽공원 ", ""), "x": round(cx, 1), "y": round(cy, 1)})

for e in els:
    t = e.get("tags", {})
    if e["type"] != "node":
        continue
    p = xy(e["lat"], e["lon"])
    if t.get("railway") == "subway_entrance":
        st = min(STATIONS, key=lambda s: (STATIONS[s][0] - e["lat"]) ** 2 + (STATIONS[s][1] - e["lon"]) ** 2)
        dist = math.hypot((STATIONS[st][0] - e["lat"]) * MY, (STATIONS[st][1] - e["lon"]) * MX)
        if dist > 350:
            continue
        places.append({"id": f"exit{e['id']}", "kind": "exit", "name": f"{st} {t.get('ref', '?')}번 출구", "station": st, "ref": t.get("ref"),
                       "wheelchair": t.get("wheelchair"), "x": p[0], "y": p[1]})
    elif t.get("amenity") == "toilets":
        places.append({"id": f"wc{e['id']}", "kind": "toilet", "name": "화장실", "wheelchair": t.get("wheelchair"), "x": p[0], "y": p[1]})

# 연결된 가장 큰 덩어리만 사용
adj: dict[int, list[int]] = {}
for a, b, _, _ in edges:
    adj.setdefault(a, []).append(b)
    adj.setdefault(b, []).append(a)
seen, best = set(), set()
for s in adj:
    if s in seen:
        continue
    comp, stack = set(), [s]
    while stack:
        u = stack.pop()
        if u in comp:
            continue
        comp.add(u)
        stack.extend(adj[u])
    seen |= comp
    if len(comp) > len(best):
        best = comp
idx = {nid: i for i, nid in enumerate(n for n in nodes if n in best)}
node_list = [nodes[n] for n in idx]
edge_list = [[idx[a], idx[b], round(l, 1), f] for a, b, l, f in edges if a in idx and b in idx]


def snap(x, y, poly=None):
    """장소를 그래프 노드에 연결: 건물은 외곽선 25m 이내 노드들(=출입 후보), 그 외는 최근접 노드"""
    if poly:
        cands = []
        for i, (nx, ny) in enumerate(node_list):
            dmin = min(math.hypot(nx - px, ny - py) for px, py in poly[::2])
            if dmin < 25:
                cands.append(i)
        if cands:
            return cands
    i = min(range(len(node_list)), key=lambda k: math.hypot(node_list[k][0] - x, node_list[k][1] - y))
    return [i]


for p in places:
    p["nodes"] = snap(p["x"], p["y"], p.pop("poly", None))

out = {
    "source": "OpenStreetMap contributors (ODbL) — Overpass API",
    "origin": [LAT0, LON0],
    "nodes": node_list,
    "edges": edge_list,
    "places": places,
    "ways": [w for w in draw_ways if any(abs(x) < 1100 and abs(y) < 700 for x, y in w["p"])],
    "buildings": buildings,
}
OUT.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")))
print(f"nodes {len(node_list)} edges {len(edge_list)} places {len(places)} buildings {len(buildings)} -> {OUT} ({OUT.stat().st_size // 1024}KB)")
for p in places:
    if p["kind"] != "toilet":
        print(p["kind"], p["name"], p.get("wheelchair"), len(p["nodes"]))
