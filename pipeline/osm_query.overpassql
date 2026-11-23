[out:json][timeout:180];
// 올림픽공원 + 올림픽공원역·몽촌토성역·한성백제역 주변
(
  way(37.5100,127.1100,37.5250,127.1330)[highway~"^(footway|path|pedestrian|steps|service|living_street|corridor|cycleway|track|residential|unclassified|tertiary|secondary)$"];
  way(37.5100,127.1100,37.5250,127.1330)[building];
  way(37.5100,127.1100,37.5250,127.1330)[amenity=parking];
  node(37.5100,127.1100,37.5250,127.1330)[highway=elevator];
  node(37.5100,127.1100,37.5250,127.1330)[entrance];
  node(37.5100,127.1100,37.5250,127.1330)[railway=subway_entrance];
  node(37.5100,127.1100,37.5250,127.1330)[amenity~"^(toilets|parking_entrance)$"];
  way(37.5100,127.1100,37.5250,127.1330)[man_made=bridge];
);
out body geom;
