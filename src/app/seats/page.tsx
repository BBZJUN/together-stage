import SeatViewer from "@/components/SeatViewer";

export const metadata = { title: "좌석 시야 미리보기 — 함께 보는 무대" };

export default function Page() {
  return (
    <div className="pb-24">
      <section className="band px-5 pb-4 pt-4">
        <h1 className="text-[1.5rem] font-bold leading-[1.4] tracking-tight">
          내 자리에서
          <br />
          무대가 보일까요?
        </h1>
      </section>
      <SeatViewer />
    </div>
  );
}
