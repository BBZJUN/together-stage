import ShowCard from "@/components/ShowCard";
import { getShows } from "@/lib/data";

export const metadata = { title: "보여주기 카드 — 함께 보는 무대" };

export default function Page() {
  const s = getShows()[0];
  return <ShowCard nextShow={s ? { title: s.title, venue: s.venue, date: s.date, start: s.start } : null} />;
}
