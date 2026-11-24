"use client";
/* eslint-disable react-hooks/immutability -- three.js 카메라·벡터는 프레임마다 직접 갱신 */

/**
 * 다른 공연장 둘러보기: 한국체육산업개발 실감형 콘텐츠(GLB)를 웹용으로 줄인 모델.
 * 객석 바닥을 누르면 그 자리 앉은 눈높이(1.15m)에서 무대 쪽을 본다.
 * 좌석별 '보임 %' 계산은 KSPO DOME에서만 제공 (좌석 배치 데이터가 있는 곳부터).
 */
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Hand, X } from "lucide-react";

export interface VenueDef {
  id: string;
  name: string;
  file: string;
  /** 위에서 볼 때 잘라낼 지붕 높이(m) */
  roofCut: number;
  /** 무대(또는 기준점) 위치 */
  stage: [number, number, number];
  stageLabel: string;
  /** 시작 카메라 위치 */
  overview: [number, number, number];
  note: string;
  /** 고를 수 있는 객석·플로어 범위 (건물 밖·무대 위 제외) */
  inside: (x: number, y: number, z: number) => boolean;
  /** 무대 바닥으로 칠할 범위 (없으면 생략) */
  stageFloor?: (x: number, y: number, z: number) => boolean;
  /** 바로 볼 수 있는 대표 자리 (x, z) — 높이는 모델에서 바닥을 찾아 정함 */
  presets: { label: string; x: number; z: number; from?: number }[];
}

export const VENUES: VenueDef[] = [
  {
    id: "handball",
    name: "티켓링크 라이브 아레나",
    file: "/models/handball.glb",
    roofCut: 11.5,
    stage: [0, 1.2, 0],
    stageLabel: "경기장 중앙",
    overview: [0, 74, 80],
    note: "핸드볼경기장. 공연마다 무대 위치가 달라 경기장 중앙을 기준으로 보여줘요.",
    inside: (x, y, z) => (x / 47) ** 2 + (z / 46) ** 2 < 1 && y < 11,
    presets: [
      { label: "플로어", x: 0, z: 14 },
      { label: "1층 옆", x: -32.5, z: 0 },
      { label: "대각선 중간", x: -24.5, z: 24.5 },
      { label: "대각선 위", x: -28, z: 28 },
    ],
  },
  {
    id: "woori",
    name: "우리금융아트홀",
    file: "/models/woori.glb",
    roofCut: 7.2,
    stage: [-14, 0.6, -4],
    stageLabel: "무대 중앙",
    overview: [-66, 40, 14],
    note: "고정 무대가 있는 공연장이라 무대 중앙을 기준으로 보여줘요. 2층(발코니)은 아래 버튼으로 볼 수 있어요.",
    inside: (x, y, z) => x > -46.5 && x < -21 && z > -27 && z < 19 && y < 12,
    stageFloor: (x, y) => x > -19.8 && x < -2 && y > -1.5 && y < -0.9,
    presets: [
      { label: "1층 앞", x: -23.5, z: -4 },
      { label: "1층 가운데", x: -29, z: -4 },
      { label: "1층 뒤", x: -34.5, z: -4 },
      { label: "2층", x: -40, z: -4, from: 10.2 },
    ],
  },
];

/** 면마다 좌석·계단·무대·벽을 구분해 꼭짓점 색을 칠한다 (모델에 재질 정보가 없어서) */
const C = {
  wall: new THREE.Color("#eceef2"),
  step: new THREE.Color("#c3c9d2"),
  seat: new THREE.Color("#3d63b8"),
  stage: new THREE.Color("#b07c45"),
};
function paint(scene: THREE.Object3D, v: VenueDef) {
  if (scene.userData.painted) return;
  scene.updateMatrixWorld(true);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const u = new THREE.Vector3(), w = new THREE.Vector3();
  scene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const g = m.geometry;
    const pos = g.attributes.position;
    const idx = g.index;
    const n = idx ? idx.count : pos.count;
    const at = (i: number) => (idx ? idx.getX(i) : i);
    // 면마다 종류를 정하고, 종류가 다른 면끼리 공유하는 꼭짓점은 복제해 색이 번지지 않게 한다
    const remap = new Map<number, number>();
    const outPos: number[] = [];
    const outCol: number[] = [];
    const outIdx = new Uint32Array(n);
    const list = [C.wall, C.step, C.stage, C.seat];
    for (let i = 0; i < n; i += 3) {
      const tri = [at(i), at(i + 1), at(i + 2)];
      a.fromBufferAttribute(pos, tri[0]).applyMatrix4(m.matrixWorld);
      b.fromBufferAttribute(pos, tri[1]).applyMatrix4(m.matrixWorld);
      c.fromBufferAttribute(pos, tri[2]).applyMatrix4(m.matrixWorld);
      u.subVectors(b, a);
      w.subVectors(c, a).cross(u);
      const area = w.length() / 2;
      const upness = area > 0 ? Math.abs(w.y) / (2 * area) : 0;
      const cx = (a.x + b.x + c.x) / 3, cy = (a.y + b.y + c.y) / 3, cz = (a.z + b.z + c.z) / 3;
      let k = 0; // 벽·구조물
      if (v.stageFloor?.(cx, cy, cz) && upness > 0.8) k = 2;
      else if (v.inside(cx, cy, cz)) k = area < 0.12 ? 3 : upness > 0.8 ? 1 : 0;
      for (let j = 0; j < 3; j++) {
        const key = tri[j] * 4 + k;
        let ni = remap.get(key);
        if (ni === undefined) {
          ni = outPos.length / 3;
          remap.set(key, ni);
          outPos.push(pos.getX(tri[j]), pos.getY(tri[j]), pos.getZ(tri[j]));
          outCol.push(list[k].r, list[k].g, list[k].b);
        }
        outIdx[i + j] = ni;
      }
    }
    const ng = new THREE.BufferGeometry();
    ng.setAttribute("position", new THREE.Float32BufferAttribute(outPos, 3));
    ng.setAttribute("color", new THREE.Float32BufferAttribute(outCol, 3));
    ng.setIndex(new THREE.BufferAttribute(outIdx, 1));
    ng.computeBoundingSphere();
    ng.computeBoundingBox();
    g.dispose();
    m.geometry = ng;
  });
  scene.userData.painted = true;
}

/** (x, z) 위에서 아래로 내려 디딤판 높이를 찾는다.
 *  처음 닿는 위쪽 면이 의자 방석일 수 있어, 그 아래 0.7m 안에서 가장 낮은 위쪽 면을 바닥으로 본다 */
function floorAt(scene: THREE.Object3D, v: VenueDef, x: number, z: number, from = v.roofCut - 0.2) {
  const rc = new THREE.Raycaster(new THREE.Vector3(x, from, z), new THREE.Vector3(0, -1, 0), 0, 40);
  const ups = rc.intersectObject(scene, true).filter((h) => {
    const n = h.face?.normal.clone().transformDirection(h.object.matrixWorld);
    return !!n && Math.abs(n.y) >= 0.8;
  });
  if (!ups.length) return null;
  const top = ups[0].point.y;
  let best = ups[0];
  for (const h of ups) if (h.point.y >= top - 0.7 && h.point.y < best.point.y) best = h;
  return best.point.clone();
}

function Model({ v, pov, onPick, onReady }: { v: VenueDef; pov: boolean; onPick: (p: THREE.Vector3) => void; onReady: (s: THREE.Object3D) => void }) {
  const { scene } = useGLTF(v.file, false, true);
  useEffect(() => onReady(scene), [scene, onReady]);
  const { gl } = useThree();
  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, -1, 0), v.roofCut), [v.roofCut]);
  useEffect(() => {
    gl.localClippingEnabled = true;
    paint(scene, v);
    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const mat = m.material as THREE.MeshStandardMaterial;
      mat.side = THREE.DoubleSide;
      mat.clippingPlanes = pov ? [] : [plane];
      mat.vertexColors = true;
      mat.color.set(pov ? "#9aa3b2" : "#ffffff");
      mat.flatShading = true;
      mat.roughness = 0.95;
      mat.metalness = 0;
      mat.needsUpdate = true;
      if (!m.geometry.attributes.normal) m.geometry.computeVertexNormals();
    });
  }, [scene, pov, plane, gl, v]);
  const down = useRef<{ x: number; y: number } | null>(null);
  return (
    <primitive
      object={scene}
      onPointerDown={(e: ThreeEvent<PointerEvent>) => (down.current = { x: e.clientX, y: e.clientY })}
      onPointerUp={(e: ThreeEvent<PointerEvent>) => {
        const d = down.current;
        if (!d || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 6 || pov) return;
        // 지붕 위(잘린 부분)를 누른 경우 무시, 위를 향한 면(바닥·계단)만
        // 모델이 한 덩어리라 이벤트에는 첫 충돌만 온다 → 직접 모든 충돌을 구해
        // 잘라낸 지붕 아래에서, 위를 향한 면(바닥·디딤판)을 찾는다. 세로면이면 그 앞에서 아래로 내려 바닥을 찾음
        e.stopPropagation();
        const rc = new THREE.Raycaster(e.ray.origin.clone(), e.ray.direction.clone());
        const up = (h: THREE.Intersection) => {
          const hn = h.face?.normal.clone().transformDirection(h.object.matrixWorld);
          return !!hn && Math.abs(hn.y) >= 0.55;
        };
        for (const h of rc.intersectObject(scene, true)) {
          if (h.point.y > v.roofCut) continue;
          if (up(h)) return v.inside(h.point.x, h.point.y, h.point.z) ? onPick(h.point.clone()) : undefined;
          const back = e.ray.direction.clone().multiplyScalar(-0.35);
          const down = new THREE.Raycaster(h.point.clone().add(back).add(new THREE.Vector3(0, 1.2, 0)), new THREE.Vector3(0, -1, 0), 0, 4);
          const floor = down.intersectObject(scene, true).find(up);
          if (floor && v.inside(floor.point.x, floor.point.y, floor.point.z)) return onPick(floor.point.clone());
          return;
        }
      }}
    />
  );
}

function Rig({ v, eye }: { v: VenueDef; eye: THREE.Vector3 | null }) {
  const { camera, gl } = useThree();
  const look = useRef({ yaw: 0, pitch: 0 });
  const target = useMemo(() => new THREE.Vector3(...v.stage), [v.stage]);
  const d = useMemo(() => new THREE.Vector3(), []);
  const aim = useMemo(() => new THREE.Vector3(), []);
  useEffect(() => {
    look.current = { yaw: 0, pitch: 0 };
    (camera as THREE.PerspectiveCamera).fov = eye ? 55 : 45;
    camera.updateProjectionMatrix();
    if (!eye) camera.position.set(...v.overview);
  }, [eye, camera, v.overview]);
  useEffect(() => {
    if (!eye) return;
    const el = gl.domElement;
    let last: { x: number; y: number } | null = null;
    const dn = (e: PointerEvent) => (last = { x: e.clientX, y: e.clientY });
    const mv = (e: PointerEvent) => {
      if (!last) return;
      const l = look.current;
      l.yaw = Math.max(-1.4, Math.min(1.4, l.yaw + (e.clientX - last.x) * 0.005));
      l.pitch = Math.max(-0.6, Math.min(0.6, l.pitch - (e.clientY - last.y) * 0.004));
      last = { x: e.clientX, y: e.clientY };
    };
    const up = () => (last = null);
    el.addEventListener("pointerdown", dn);
    window.addEventListener("pointermove", mv);
    window.addEventListener("pointerup", up);
    return () => {
      el.removeEventListener("pointerdown", dn);
      window.removeEventListener("pointermove", mv);
      window.removeEventListener("pointerup", up);
    };
  }, [eye, gl]);
  useFrame((_, dt) => {
    if (!eye) return;
    camera.position.lerp(eye, 1 - Math.exp(-dt * 8));
    d.copy(target).sub(camera.position);
    d.applyAxisAngle(new THREE.Vector3(0, 1, 0), -look.current.yaw);
    d.y += Math.tan(look.current.pitch) * Math.hypot(d.x, d.z);
    camera.lookAt(aim.copy(camera.position).add(d));
  });
  return null;
}

export default function VenueExplore({ venue }: { venue: VenueDef }) {
  const [eye, setEye] = useState<THREE.Vector3 | null>(null);
  const [scene, setScene] = useState<THREE.Object3D | null>(null);
  const [spot, setSpot] = useState<string | null>(null);
  const goPreset = (p: VenueDef["presets"][number]) => {
    if (!scene) return;
    const f = floorAt(scene, venue, p.x, p.z, p.from);
    if (!f) return;
    setSpot(p.label);
    setEye(f.add(new THREE.Vector3(0, 1.15, 0)));
  };
  const dist = eye ? Math.round(Math.hypot(eye.x - venue.stage[0], eye.z - venue.stage[2])) : 0;
  return (
    <div className="relative h-full w-full">
      <Canvas dpr={[1, 1.75]} camera={{ position: venue.overview, fov: 45, near: 0.1, far: 500 }} style={{ touchAction: "none" }}>
        <color attach="background" args={[eye ? "#151922" : "#f2f4f6"]} />
        <hemisphereLight args={eye ? ["#d6def0", "#2b303b", 2.1] : ["#ffffff", "#8b95a1", 1.7]} />
        <directionalLight position={[30, 60, 20]} intensity={eye ? 0.9 : 1.5} />
        <directionalLight position={[-40, 30, -30]} intensity={eye ? 0.4 : 0.7} />
        {eye && <pointLight position={[venue.stage[0], venue.stage[1] + 6, venue.stage[2]]} intensity={600} distance={60} color="#ffffff" />}
        <Suspense fallback={null}>
          <Model
            v={venue}
            pov={!!eye}
            onReady={setScene}
            onPick={(p) => {
              setSpot(null);
              const f = scene ? floorAt(scene, venue, p.x, p.z, p.y + 0.6) : null;
              setEye((f && Math.abs(f.y - p.y) < 0.8 ? f : p).add(new THREE.Vector3(0, 1.15, 0)));
            }}
          />
        </Suspense>
        {/* 기준점 표시 */}
        <mesh position={venue.stage} visible={!eye}>
          <sphereGeometry args={[0.6, 16, 12]} />
          <meshBasicMaterial color="#3182f6" />
        </mesh>
        <Rig v={venue} eye={eye} />
        {!eye && <OrbitControls target={[venue.stage[0], 0, venue.stage[2]]} maxPolarAngle={Math.PI / 2.1} minDistance={10} maxDistance={140} />}
      </Canvas>
      {eye ? (
        <div className="absolute inset-x-3 top-3 z-20 flex items-start justify-between gap-2">
          <div className="rounded-2xl bg-black/55 px-3.5 py-2.5 text-white backdrop-blur-md">
            <p className="text-[0.8125rem] opacity-80">
              {venue.name}
              {spot ? ` · ${spot}` : ""} · 앉은 눈높이 1.15m
            </p>
            <p className="text-[1.0625rem] font-bold">
              {venue.stageLabel}까지 {dist}m
            </p>
            <p className="mt-1 flex items-center gap-1 text-[0.75rem] opacity-80">
              <Hand size={12} aria-hidden /> 끌어서 둘러보기
            </p>
          </div>
          <button onClick={() => setEye(null)} aria-label="1인칭 시점 닫기" className="press grid h-11 w-11 place-items-center rounded-full bg-black/55 text-white backdrop-blur-md">
            <X size={20} />
          </button>
        </div>
      ) : (
        <p className="pointer-events-none absolute inset-x-4 top-3 z-10 rounded-2xl bg-white/90 px-3.5 py-2.5 text-[0.8125rem] leading-relaxed text-ink-2 shadow-sm backdrop-blur">
          <b className="text-ink">객석 바닥을 누르면</b> 그 자리 눈높이로 무대 쪽을 보여드려요. {venue.note} 좌석별 &lsquo;보임 %&rsquo;는 KSPO DOME에서 제공해요.
        </p>
      )}
      <div className="absolute inset-x-0 bottom-3 z-20 px-3">
        <p className={`mb-1.5 text-[0.75rem] font-semibold ${eye ? "text-white/80" : "text-ink-2"}`}>대표 자리 바로 보기</p>
        <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="대표 자리 바로 보기">
          {venue.presets.map((p) => {
            const on = !!eye && spot === p.label;
            return (
              <button
                key={p.label}
                onClick={() => goPreset(p)}
                disabled={!scene}
                aria-pressed={on}
                className={`press min-h-11 shrink-0 rounded-full px-4 text-[0.9375rem] font-semibold shadow-sm disabled:opacity-50 ${
                  on ? "bg-blue text-white" : eye ? "bg-black/55 text-white backdrop-blur-md" : "bg-white text-ink"
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>
      {!eye && (
        <div className="pointer-events-none absolute right-3 top-[8.5rem] z-10 flex flex-col gap-1 rounded-xl bg-white/90 px-2.5 py-2 text-[0.75rem] text-ink-2 shadow-sm" aria-hidden>
          <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm" style={{ background: "#3d63b8" }} />좌석</span>
          {venue.stageFloor && <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm" style={{ background: "#b07c45" }} />무대</span>}
          <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-blue" />{venue.stageLabel}</span>
        </div>
      )}
    </div>
  );
}

