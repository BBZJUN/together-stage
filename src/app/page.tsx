import { getShows, data } from "@/lib/data";
import Home from "@/components/Home";

export default function Page() {
  return <Home shows={getShows()} source={data.source} />;
}
