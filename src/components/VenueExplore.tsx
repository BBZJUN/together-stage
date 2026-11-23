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
}

export const VENUES: VenueDef[] = [
  {
    id: "handball",
    name: "티켓링크 라이브 아레나",
    file: "/models/handball.glb",
    roofCut: 11.5,
    stage: [0, 1.2, 0],
    stageLabel: "경기장 중앙",
    overview: [0, 92, 98],
    note: "핸드볼경기장. 공연마다 무대 위치가 달라 경기장 중앙을 기준으로 보여줘요.",
    inside: (x, y, z) => (x / 47) ** 2 + (z / 46) ** 2 < 1 && y < 11,
  },
  {
    id: "woori",
    name: "우리금융아트홀",
    file: "/models/woori.glb",
    roofCut: 10.5,
    stage: [-14, 0.6, -4],
    stageLabel: "무대 중앙",
    overview: [-64, 46, 30],
    note: "고정 무대가 있는 공연장이라 무대 중앙을 기준으로 보여줘요.",
    inside: (x, y, z) => x > -46.5 && x < -21 && z > -27 && z < 19 && y < 10,
  },
];

function Model({ v, pov, onPick }: { v: VenueDef; pov: boolean; onPick: (p: THREE.Vector3) => void }) {
  const { scene } = useGLTF(v.file, false, true);
  const { gl } = useThree();
  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, -1, 0), v.roofCut), [v.roofCut]);
  useEffect(() => {
    gl.localClippingEnabled = true;
    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const mat = m.material as THREE.MeshStandardMaterial;
      mat.side = THREE.DoubleSide;
      mat.clippingPlanes = pov ? [] : [plane];
      mat.color.set(pov ? "#5b6372" : "#e3e7ec");
      mat.flatShading = true;
      mat.roughness = 0.95;
      mat.metalness = 0;
      mat.needsUpdate = true;
      if (!m.geometry.attributes.normal) m.geometry.computeVertexNormals();
    });
  }, [scene, pov, plane, gl]);
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
  const dist = eye ? Math.round(Math.hypot(eye.x - venue.stage[0], eye.z - venue.stage[2])) : 0;
  return (
    <div className="relative h-full w-full">
      <Canvas dpr={[1, 1.75]} camera={{ position: venue.overview, fov: 45, near: 0.1, far: 500 }} style={{ touchAction: "none" }}>
        <color attach="background" args={[eye ? "#0b0d12" : "#f2f4f6"]} />
        <hemisphereLight args={eye ? ["#b8c6e6", "#1a1d24", 1.4] : ["#ffffff", "#8b95a1", 1.6]} />
        <directionalLight position={[30, 60, 20]} intensity={eye ? 0.5 : 1.6} />
        <directionalLight position={[-40, 30, -30]} intensity={eye ? 0.2 : 0.6} />
        {eye && <pointLight position={[venue.stage[0], venue.stage[1] + 6, venue.stage[2]]} intensity={600} distance={60} color="#ffffff" />}
        <Suspense fallback={null}>
          <Model v={venue} pov={!!eye} onPick={(p) => setEye(p.add(new THREE.Vector3(0, 1.15, 0)))} />
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
            <p className="text-[0.8125rem] opacity-80">{venue.name} · 앉은 눈높이 1.15m</p>
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
    </div>
  );
}

