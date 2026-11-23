import walk from "@/data/walk.json";

/** 가공 데이터 재공개: 올림픽공원 무장애 보행 네트워크 (GeoJSON, OSM ODbL) */
const LAT0 = 37.5185;
const LON0 = 127.1215;
const MY = 111_320;
const MX = 111_320 * Math.cos((LAT0 * Math.PI) / 180);
const ll = ([x, y]: number[]) => [+(LON0 + x / MX).toFixed(7), +(LAT0 - y / MY).toFixed(7)];

export function GET() {
  const w = walk as unknown as {
    nodes: number[][];
    edges: [number, number, number, number][];
    places: { id: string; kind: string; name: string; x: number; y: number }[];
  };
  const features = [
    ...w.edges.map(([a, b, len, f]) => ({
      type: "Feature",
      geometry: { type: "LineString", coordinates: [ll(w.nodes[a]), ll(w.nodes[b])] },
      properties: {
        length_m: len,
        steps: !!(f & 1),
        rough_surface: !!(f & 2),
        road: !!(f & 4),
        covered: !!(f & 8),
        wheelchair_no: !!(f & 16),
        incline: !!(f & 32),
        wheelchair_ok: !(f & 1) && !(f & 16),
      },
    })),
    ...w.places.map((p) => ({ type: "Feature", geometry: { type: "Point", coordinates: ll([p.x, p.y]) }, properties: { id: p.id, kind: p.kind, name: p.name } })),
  ];
  return Response.json(
    {
      type: "FeatureCollection",
      name: "olympicpark_accessible_walk_network",
      license: "ODbL — © OpenStreetMap contributors, 가공: 함께 보는 무대",
      features,
    },
    { headers: { "Content-Disposition": 'attachment; filename="olympicpark_walk_network.geojson"' } },
  );
}
