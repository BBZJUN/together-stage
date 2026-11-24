import Link from "next/link";
import { Download } from "lucide-react";

export const metadata = { title: "가공 데이터 공개 — 함께 보는 무대" };

const SETS = [
  {
    title: "KSPO DOME 좌석별 시야",
    file: "/open/kspo_dome_seat_visibility.csv",
    fmt: "CSV · 16,127행",
    cycle: "무대 배치가 바뀔 때",
    from: "한국체육산업개발 「올림픽공원 공연장 실감형 콘텐츠(KSPO DOME)」",
    desc: "실측 3D 형상에서 좌석마다 무대가 몇 % 보이는지 계산한 값이에요. 앞사람이 앉았을 때와 일어섰을 때, 가리는 주원인, 휠체어석 여부, 좌표가 들어 있어요. 다른 무대 배치는 무대 접근성 점검에서 바로 CSV로 받을 수 있어요.",
    cols: "좌석ID, 층, 블록, 구역, 열, 번호, 휠체어석, x·y·z(m), 무대까지(m), 앉아서 보임(%), 일어서서 보임(%), 주원인",
  },
  {
    title: "올림픽공원 무장애 보행 네트워크",
    file: "/api/open/walk",
    fmt: "GeoJSON · 보행 구간 4,530개 + 장소",
    cycle: "주 1회 (OpenStreetMap 갱신)",
    from: "OpenStreetMap(ODbL) + 한국체육산업개발 입출차 데이터(주차장 위치)",
    desc: "역 출구·주차장·공연장 입구를 잇는 보행 구간마다 계단, 울퉁불퉁한 바닥, 차도, 지붕, 휠체어 불가, 경사 여부를 붙였어요. 휠체어 길찾기를 그대로 다시 만들 수 있어요.",
    cols: "length_m, steps, rough_surface, road, covered, wheelchair_no, incline, wheelchair_ok",
  },
  {
    title: "공연 회차별 시간대 혼잡 예측",
    file: "/api/open/shows",
    fmt: "CSV · 매일 갱신",
    cycle: "매일 05:41",
    from: "올림픽공원 공식 일정안내 + 「2025 차량입출차·공연·날씨 연계 데이터」 학습 모델 + Open-Meteo",
    desc: "앞으로 45일 안의 실제 공연 회차마다 시간대별 예상 주차대수와 혼잡 단계를 담았어요. 교통·안전 인력 배치나 셔틀 운영 계획에 쓸 수 있어요.",
    cols: "회차ID, 공연명, 공연장, 공연일, 시작, 시각, 예상주차대수, 예상혼잡도(%), 단계",
  },
];

export default function Page() {
  return (
    <div className="pb-10">
      <section className="px-5 pt-6">
        <p className="text-[0.8125rem] font-semibold text-ink-3">공공데이터 → 가공 → 다시 공개</p>
        <h1 className="mt-1 text-[1.625rem] font-bold leading-snug tracking-tight">가공 데이터 공개</h1>
        <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-2">
          한국체육산업개발 공공데이터를 가공해 만든 데이터를 누구나 내려받을 수 있게 열어 뒀어요. 다른 서비스나 기관 업무에서 자유롭게 쓰세요.
        </p>
      </section>
      <ul className="mt-5 flex flex-col gap-3">
        {SETS.map((d) => (
          <li key={d.title} className="band px-5 py-5">
            <h2 className="text-[1.125rem] font-bold">{d.title}</h2>
            <p className="mt-0.5 text-[0.8125rem] text-ink-3">
              {d.fmt} · 갱신 {d.cycle}
            </p>
            <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-2">{d.desc}</p>
            <dl className="mt-3 grid grid-cols-[4rem_1fr] gap-y-1.5 text-[0.8125rem]">
              <dt className="text-ink-3">원천</dt>
              <dd className="text-ink-2">{d.from}</dd>
              <dt className="text-ink-3">항목</dt>
              <dd className="text-ink-2">{d.cols}</dd>
            </dl>
            <a href={d.file} download className="press mt-4 flex h-12 items-center justify-center gap-2 rounded-2xl bg-grey-100 text-[0.9375rem] font-bold">
              <Download size={17} aria-hidden /> 내려받기
            </a>
          </li>
        ))}
      </ul>
      <p className="mt-4 px-5 text-[0.75rem] leading-relaxed text-ink-3">
        이용허락: 원천 데이터의 이용 조건을 따라요(공공데이터 이용허락범위 제한 없음, OpenStreetMap은 ODbL로 출처 표기). 좌석 위치·구역 경계·휠체어석 세부 위치는 공식 좌석배치도를 바탕으로 한 추정이에요.{" "}
        <Link href="/check" prefetch={false} className="underline underline-offset-2">
          다른 무대 배치로 계산하기
        </Link>
      </p>
    </div>
  );
}
