"use client";

import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";
import { Suspense, useEffect, useRef } from "react";
import * as THREE from "three";
import { FLOOR_R, stageFrontX, type Seat, type StageConfig } from "@/lib/venue";
import { ConcertPost, ConcertStage, Crowd } from "./ConcertScene";

export type ViewMode = "overview" | "seat";

interface Props {
  seats: Seat[];
  colors: Float32Array; // seats.length * 3
  stage: StageConfig;
  selected: Seat | null;
  mode: ViewMode;
  standing: boolean;
  /** 휠체어석 단상 높이(m) */
  platform?: number;
  onSelect: (s: Seat) => void;
}

const SX = stageFrontX();

function Seats({ seats, colors, onSelect, selected, hidden }: Pick<Props, "seats" | "colors" | "onSelect" | "selected"> & { hidden?: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useEffect(() => {
    const m = ref.current;
    if (!m) return;
    const o = new THREE.Object3D();
    seats.forEach((s, i) => {
      o.position.set(s.pos[0], s.pos[1] + 0.6, s.pos[2]);
      o.lookAt(SX, s.pos[1] + 0.6, 0);
      const k = s.wheelchair ? 1.8 : 1;
      o.scale.set(k, k, k);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  }, [seats]);
  useEffect(() => {
    const m = ref.current;
    if (!m) return;
    const c = new THREE.Color();
    seats.forEach((s, i) => {
      if (selected && s.id === selected.id) c.set("#ff3d6e");
      else c.setRGB(colors[i * 3], colors[i * 3 + 1], colors[i * 3 + 2]);
      m.setColorAt(i, c);
    });
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [colors, seats, selected]);
  return (
    <instancedMesh
      ref={ref}
      visible={!hidden}
      args={[undefined, undefined, seats.length]}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        if (e.instanceId !== undefined) onSelect(seats[e.instanceId]);
      }}
    >
      <boxGeometry args={[0.4, 0.3, 0.4]} />
      <meshStandardMaterial roughness={0.8} />
    </instancedMesh>
  );
}

/** 실감형 콘텐츠(KSPO DOME 3D 스캔) — 지붕 제외, meshopt 압축 GLB */
function KspoModel({ night }: { night: boolean }) {
  const { scene } = useGLTF("/models/kspo.glb", false, true);
  useEffect(() => {
    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const mat = m.material as THREE.MeshStandardMaterial;
      if (!mat?.color) return;
      mat.userData.day ??= mat.color.clone();
      mat.color.copy(mat.userData.day as THREE.Color).multiplyScalar(night ? 0.12 : 1);
    });
  }, [scene, night]);
  useEffect(() => {
    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.raycast = () => null; // 좌석 클릭을 가리지 않도록
        const mat = m.material as THREE.MeshStandardMaterial;
        if (mat) {
          mat.side = THREE.DoubleSide;
          mat.roughness = 0.9;
        }
      }
    });
  }, [scene]);
  return <primitive object={scene} />;
}

function StageMeshes({ stage }: { stage: StageConfig }) {
  const cx = SX - stage.depth / 2;
  return (
    <group>
      {/* 플로어 */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.02, 0]}>
        <circleGeometry args={[FLOOR_R, 64]} />
        <meshStandardMaterial color="#dfe5ec" />
      </mesh>
      {/* 메인 무대 */}
      <mesh position={[cx, stage.height / 2, 0]} castShadow>
        <boxGeometry args={[stage.depth, stage.height, stage.width]} />
        <meshStandardMaterial color="#2b3445" />
      </mesh>
      {/* LED */}
      <mesh position={[SX - stage.depth + 0.3, stage.height + stage.ledHeight / 2, 0]}>
        <boxGeometry args={[0.4, stage.ledHeight, stage.width * 0.8]} />
        <meshStandardMaterial color="#3182f6" emissive="#1b64da" emissiveIntensity={0.6} />
      </mesh>
      {stage.type === "thrust" && stage.thrustLength > 0 && (
        <mesh position={[SX + stage.thrustLength / 2, stage.height / 2, 0]}>
          <boxGeometry args={[stage.thrustLength, stage.height, 5]} />
          <meshStandardMaterial color="#2b3445" />
        </mesh>
      )}
      {stage.speakers &&
        [-1, 1].map((s) => (
          <mesh key={s} position={[SX - 0.8, 9.5, s * (stage.width / 2 + 1.8)]}>
            <boxGeometry args={[2.4, 7, 2.2]} />
            <meshStandardMaterial color="#111827" />
          </mesh>
        ))}
      {/* FOH 데스크 */}
      <mesh position={[8.25, 1.3, 0]}>
        <boxGeometry args={[4.5, 2.6, 7]} />
        <meshStandardMaterial color="#8b95a1" />
      </mesh>
    </group>
  );
}

function CameraRig({ mode, selected, stage, platform = 0 }: Pick<Props, "mode" | "selected" | "stage" | "platform">) {
  const { camera, gl } = useThree();
  const target = useRef(new THREE.Vector3());
  const goal = useRef(new THREE.Vector3(70, 55, 0));
  const look = useRef({ yaw: 0, pitch: 0 });
  // eslint-disable-next-line react-hooks/immutability -- three.js 객체는 프레임마다 직접 갱신
  useEffect(() => {
    look.current = { yaw: 0, pitch: 0 };
    if (mode === "seat" && selected) {
      // 눈높이: 휠체어 1.2m(+단상), 의자 1.15m, 플로어 스탠딩 1.6m
      const eyeH = selected.tier === "플로어" ? 1.6 : selected.wheelchair ? 1.2 + platform : 1.15;
      goal.current.set(selected.pos[0], selected.pos[1] + eyeH, selected.pos[2]);
      target.current.set(SX - 2, stage.height + 2.5, 0);
      // eslint-disable-next-line react-hooks/immutability -- three.js 객체는 프레임마다 직접 갱신
      (camera as THREE.PerspectiveCamera).fov = 50;
    } else {
      goal.current.set(70, 62, 48);
      target.current.set(0, 2, 0);
      (camera as THREE.PerspectiveCamera).fov = 45;
    }
    camera.updateProjectionMatrix();
  }, [mode, selected, stage.height, platform, camera]);
  // 좌석 시점에서 드래그로 고개 돌리기 (좌우 ±75°, 위아래 ±30°)
  useEffect(() => {
    if (mode !== "seat") return;
    const el = gl.domElement;
    let last: { x: number; y: number } | null = null;
    const down = (e: PointerEvent) => (last = { x: e.clientX, y: e.clientY });
    const move = (e: PointerEvent) => {
      if (!last) return;
      const l = look.current;
      l.yaw = Math.max(-1.3, Math.min(1.3, l.yaw + (e.clientX - last.x) * 0.005));
      l.pitch = Math.max(-0.5, Math.min(0.5, l.pitch - (e.clientY - last.y) * 0.004));
      last = { x: e.clientX, y: e.clientY };
    };
    const up = () => (last = null);
    el.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      el.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [mode, gl]);
  const tmp = useRef(new THREE.Vector3());
  const aim = useRef(new THREE.Vector3());
  useFrame((_, delta) => {
    if (mode !== "seat") return;
    camera.position.lerp(goal.current, 1 - Math.exp(-delta * 8));
    const d = tmp.current.copy(target.current).sub(camera.position);
    const { yaw, pitch } = look.current;
    d.applyAxisAngle(new THREE.Vector3(0, 1, 0), -yaw);
    const r = Math.hypot(d.x, d.z);
    d.y += Math.tan(pitch) * r;
    camera.lookAt(aim.current.copy(camera.position).add(d));
  });
  return null;
}

export default function Venue3D(props: Props) {
  const { mode, selected, stage, standing, platform = 0 } = props;
  const night = mode === "seat" && !!selected;
  return (
    <Canvas
      shadows={false}
      dpr={night ? [1, 1.5] : [1, 2]}
      camera={{ position: [70, 62, 48], fov: 45, near: 0.1, far: 600 }}
      style={{ touchAction: "none" }}
      gl={{ preserveDrawingBuffer: true }}
    >
      <color attach="background" args={[night ? "#05070c" : "#f2f4f6"]} />
      {night && <fog attach="fog" args={["#05070c", 70, 160]} />}
      <hemisphereLight args={night ? ["#26314d", "#05070c", 0.25] : ["#ffffff", "#b9c2cc", 1.1]} />
      <directionalLight position={[30, 60, 20]} intensity={night ? 0.08 : 1.1} />
      <Suspense fallback={null}>
        <KspoModel night={night} />
      </Suspense>
      {night ? <ConcertStage stage={stage} /> : <StageMeshes stage={stage} />}
      <Seats seats={props.seats} colors={props.colors} onSelect={props.onSelect} selected={selected} hidden={night} />
      {night && selected && <Crowd seats={props.seats} selected={selected} standing={standing} />}
      {night && <ConcertPost />}
      <CameraRig mode={mode} selected={selected} stage={stage} platform={platform} />
      {mode === "overview" && <OrbitControls target={[0, 2, 0]} maxPolarAngle={Math.PI / 2.15} minDistance={15} maxDistance={170} />}
    </Canvas>
  );
}

useGLTF.preload("/models/kspo.glb", false, true);
