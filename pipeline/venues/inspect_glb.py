"""내려받은 GLB의 크기·단위·좌표축을 점검한다."""
import sys, pathlib, trimesh
root = pathlib.Path(sys.argv[1])
for g in sorted(root.rglob("*")):
    if g.suffix.lower() not in (".glb", ".gltf"):
        continue
    print("==", g, g.stat().st_size // 1024, "KB")
    try:
        sc = trimesh.load(g, force="scene")
        b = sc.bounds
        tri = sum(len(m.faces) for m in sc.geometry.values() if hasattr(m, "faces"))
        print("geoms", len(sc.geometry), "tris", tri)
        print("bounds min", b[0].round(2).tolist(), "max", b[1].round(2).tolist(), "size", (b[1] - b[0]).round(2).tolist())
        names = list(sc.geometry.keys())[:25]
        print("names", names)
    except Exception as e:
        print("load fail", e)
