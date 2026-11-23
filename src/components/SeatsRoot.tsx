"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import SeatViewer from "./SeatViewer";
import { VENUES } from "./VenueExplore";

const VenueExplore = dynamic(() => import("./VenueExplore"), { ssr: false });

const TABS = [{ id: "kspo", name: "KSPO DOME" }, ...VENUES.map((v) => ({ id: v.id, name: v.id === "handball" ? "핸드볼경기장" : v.name }))];

export default function SeatsRoot() {
  const params = useSearchParams();
  const id = params.get("venue") ?? "kspo";
  const venue = VENUES.find((v) => v.id === id);
  return (
    <div style={{ ["--tabs" as string]: "52px" }}>
      <nav aria-label="공연장 선택" className="flex h-[52px] items-center gap-1.5 overflow-x-auto bg-white px-4">
        {TABS.map((t) => {
          const on = t.id === (venue?.id ?? "kspo");
          return (
            <Link
              key={t.id}
              href={t.id === "kspo" ? "/seats" : `/seats?venue=${t.id}`}
              aria-current={on ? "page" : undefined}
              className={`press shrink-0 rounded-full px-3.5 py-2 text-[0.875rem] font-semibold ${on ? "bg-ink text-white" : "bg-grey-100 text-ink-2"}`}
            >
              {t.name}
            </Link>
          );
        })}
      </nav>
      {venue ? (
        <div className="relative h-[calc(100dvh-7rem-52px-env(safe-area-inset-bottom))] min-h-[520px] overflow-hidden bg-grey-100">
          <VenueExplore key={venue.id} venue={venue} />
        </div>
      ) : (
        <SeatViewer />
      )}
    </div>
  );
}
