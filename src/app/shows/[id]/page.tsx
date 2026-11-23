import { notFound } from "next/navigation";
import { getShow, getShows } from "@/lib/data";
import ShowDetail from "@/components/ShowDetail";

export function generateStaticParams() {
  return getShows().map((s) => ({ id: s.id }));
}

export default async function Page(props: PageProps<"/shows/[id]">) {
  const { id } = await props.params;
  const show = getShow(id);
  if (!show) notFound();
  return <ShowDetail show={show} />;
}
