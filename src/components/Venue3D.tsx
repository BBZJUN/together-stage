"use client";

import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";
import { Suspense, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { FLOOR_R, heightAt, stageFrontX, type Seat, type StageConfig } from "@/lib/venue";

export type ViewMode = "overview" | "seat";

interface Props {
  seats: Seat[];
  colors: Float32Array; // seats.length * 3
  stage: StageConfig;
  selected: Seat | null;
  mode: ViewMode;
  standing: boolean;
  onSelect: (s: Seat) => void;
}

const SX = stageFrontX();

function Seats({ seats, colors, onSelect, selected }: Pick<Props, "seats" | "colors" | "onSelect" | "selected">) {
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
function KspoModel() {
  const { scene } = useGLTF("/models/kspo.glb", false, true);
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

function CameraRig({ mode, selected, stage }: Pick<Props, "mode" | "selected" | "stage"> & { standing: boolean }) {
  const { camera } = useThree();
  const target = useRef(new THREE.Vector3());
  const goal = useRef(new THREE.Vector3(70, 55, 0));
  useEffect(() => {
    if (mode === "seat" && selected) {
      const eyeH = selected.wheelchair ? 1.2 : 1.15;
      goal.current.set(selected.pos[0], selected.pos[1] + eyeH, selected.pos[2]);
      target.current.set(SX - 2, stage.height + 2.5, 0);
    } else {
      goal.current.set(70, 62, 48);
      target.current.set(0, 2, 0);
    }
  }, [mode, selected, stage.height]);
  useFrame((_, delta) => {
    if (mode !== "seat") return;
    // 프레임 속도와 관계없이 약 0.5초 안에 좌석 시점으로 이동
    camera.position.lerp(goal.current, 1 - Math.exp(-delta * 8));
    camera.lookAt(target.current);
  });
  return null;
}

export default function Venue3D(props: Props) {
  const { mode, selected, stage, standing } = props;
  return (
    <Canvas
      shadows={false}
      dpr={[1, 2]}
      camera={{ position: [70, 62, 48], fov: 45, near: 0.1, far: 600 }}
      style={{ touchAction: "none" }}
    >
      <color attach="background" args={["#f2f4f6"]} />
      <hemisphereLight args={["#ffffff", "#b9c2cc", 1.1]} />
      <directionalLight position={[30, 60, 20]} intensity={1.1} />
      <Suspense fallback={null}>
        <KspoModel />
      </Suspense>
      <StageMeshes stage={stage} />
      <Seats seats={props.seats} colors={props.colors} onSelect={props.onSelect} selected={selected} />
      {/* 앞사람이 일어선 상황을 시점 화면에서 느끼게: 선택 좌석 앞줄에 실루엣 */}
      {mode === "seat" && selected && standing && <FrontCrowd seat={selected} />}
      <CameraRig mode={mode} selected={selected} stage={stage} standing={standing} />
      {mode === "overview" && <OrbitControls target={[0, 2, 0]} maxPolarAngle={Math.PI / 2.15} minDistance={15} maxDistance={170} />}
    </Canvas>
  );
}

/** 선택 좌석 앞 2줄에 서 있는 관객 실루엣 */
function FrontCrowd({ seat }: { seat: Seat }) {
  const items = useMemo(() => {
    const out: THREE.Vector3[] = [];
    const dir = new THREE.Vector2(SX - seat.pos[0], -seat.pos[2]).normalize(); // (x, z) 무대 방향
    const perp = new THREE.Vector2(-dir.y, dir.x);
    const gap = seat.tier === "플로어" ? 0.75 : 0.85;
    for (let row = 1; row <= 3; row++) {
      for (let k = -3; k <= 3; k++) {
        if (row > 1 && (row + k) % 2 === 0) continue;
        const d = row * gap;
        const x = seat.pos[0] + dir.x * d + perp.x * k * 0.55;
        const z = seat.pos[2] + dir.y * d + perp.y * k * 0.55;
        const y = seat.tier === "플로어" ? 0 : Math.max(0, heightAt(x, z) - 0.35);
        out.push(new THREE.Vector3(x, y, z));
      }
    }
    return out;
  }, [seat]);
  return (
    <group>
      {items.map((p, i) => (
        <group key={i} position={p}>
          <mesh position={[0, 0.75, 0]}>
            <capsuleGeometry args={[0.2, 0.9, 4, 8]} />
            <meshStandardMaterial color="#4e5968" transparent opacity={0.82} />
          </mesh>
          <mesh position={[0, 1.6, 0]}>
            <sphereGeometry args={[0.13, 12, 12]} />
            <meshStandardMaterial color="#4e5968" transparent opacity={0.82} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

useGLTF.preload("/models/kspo.glb", false, true);
