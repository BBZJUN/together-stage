import { Suspense } from "react";
import SeatViewer from "@/components/SeatViewer";

export const metadata = { title: "좌석 시야 미리보기 — 함께 보는 무대" };

export default function Page() {
  return (
    <Suspense fallback={<div className="h-[70dvh]" />}>
      <SeatViewer />
    </Suspense>
  );
}
