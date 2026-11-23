import { Suspense } from "react";
import RouteFinder from "@/components/RouteFinder";

export const metadata = { title: "계단 없는 길 찾기 — 함께 보는 무대" };

export default function Page() {
  return (
    <Suspense>
      <RouteFinder />
    </Suspense>
  );
}
