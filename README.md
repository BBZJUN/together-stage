# 함께 보는 무대 (together-stage)

> 휠체어 이용자, 계단이 힘든 사람, 저시력·고령 관객이 올림픽공원 공연을 **도착부터 내 자리까지** 걱정 없이 볼 수 있게 돕는 서비스

2026년도 한국체육산업개발(주) 공공데이터 활용 경진대회 활용사례 출품작

---

## 왜 만들었나

공연장 정보는 대부분 "몇 번 출구에서 도보 10분"으로 끝납니다. 휠체어를 타거나 계단이 힘든 관객에게 필요한 건 다른 질문입니다.

- 그 길에 **계단**이 있나? 비 오는 날 **미끄러운 길**은 없나?
- 어느 **출구**에 엘리베이터가 있나?
- 휠체어석에서 **무대가 보이나?** 앞사람이 일어서면?
- 언제 가야 **덜 붐비나?** 끝나고 언제 나와야 인파에 안 휩쓸리나?

## 주요 기능

| 기능 | 설명 |
|---|---|
| 도움 유형 설정 | 휠체어 · 계단이 힘듦 · 저시력 · 청각 · 어르신 동반 (복수 선택). 저시력·어르신은 큰 글씨 화면 |
| 계단 없는 길찾기 | 역 출구·주차장 → 공연장 입구. 휠체어는 계단 제외, 비 오는 날은 미끄러운 바닥 회피, 조건에 맞는 출구 자동 추천 |
| 3D 좌석 시야 | KSPO DOME 실감형 콘텐츠(3D 스캔)로 16,000여 석의 무대 시야 계산. 휠체어석 시점, 앞사람이 일어섰을 때 비교 |
| 붐비지 않는 도착·퇴장 | 실제 입출차 기록으로 보정한 시간대별 혼잡 예측, 공연 후 인파가 빠지는 시점 안내 |
| 말로 물어보기 | 길·화장실·휠체어석 시야를 조회하는 AI 안내 (음성 입력·읽어주기). AI 키가 없어도 규칙 기반으로 동작 |

## 사용 데이터

**한국체육산업개발(주)**
- 올림픽공원 공연장 실감형 콘텐츠 (KSPO DOME, DAE 2,635,561 삼각형 → 웹용 GLB 1.7MB + 0.5m 높이지도)
- 올림픽공원 입출차 정보 (2024년 7월, 215,528건) — 평일·주말 기본 수요, 행사일 패턴, 출차 처리량 보정
- 올림픽공원 차량입출차·공연·날씨 연계 데이터 API (2025년, 7,803건)
- 올림픽공원 입출차정보(전체구역) API (2025년, 약 240만 건, 입·출구 게이트 포함)
- 올림픽공원 공연정보 API

**민간·타기관**
- OpenStreetMap 올림픽공원 보행 네트워크 (보행로·계단·바닥재·지하철 출구·화장실) — © OpenStreetMap contributors, ODbL
- 기상청 날씨 (연계 데이터에 포함)

## 구조

```
pipeline/                    데이터 처리 (Python)
  analyze_inout.py           입출차 분석 → calibration.json
  build_forecast.py          공연일 혼잡 예측 → src/data/shows.json
  build_graph.py             OSM → 길찾기 그래프 src/data/walk.json
  fetch_api.py               공공데이터 API 수집 (GitHub Actions)
src/lib/
  route.ts                   다익스트라 길찾기 (도움 유형·날씨별 비용)
  venue.ts                   실측 높이지도 기반 좌석 생성·시야 레이마칭
  agent.ts                   AI 안내 툴 정의 + 규칙 기반 응답
src/components/
  Venue3D.tsx                Three.js 3D 공연장
  ParkMap.tsx                OSM 데이터로 직접 그리는 지도 (타일 서버 불필요)
public/models/kspo.glb       KSPO DOME 3D (meshopt 압축)
.github/workflows/           데이터 자동 갱신
```

## 실행

```bash
npm install
cp .env.example .env.local   # AI 키 (선택)
npm run dev
```

데이터 다시 만들기:
```bash
python3 pipeline/analyze_inout.py     # pipeline/raw/ 에 입출차 CSV 필요
python3 pipeline/build_forecast.py
python3 pipeline/build_graph.py       # pipeline/samples/osm_olpark.json 필요 (Actions가 수집)
```

## 운영 (2028년까지)

- 정적 배포(Vercel) + 하루 1회 GitHub Actions 배치 → 서버·지도 타일 비용 없음
- AI 응답은 저가 모델 + 캐시, 키가 없거나 장애 시 규칙 기반으로 자동 전환

## 한계와 다음 단계

- 휠체어석 위치와 무대 배치는 예시입니다. 공연장별 실제 좌석 배치도·현장 조사로 교체할 예정입니다.
- 계단·엘리베이터 정보는 OpenStreetMap에 표시된 곳 기준입니다. 현장 조사 결과를 OSM에 기여해 함께 개선합니다.
