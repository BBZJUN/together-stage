"use client";

/**
 * 좌석 1인칭 "공연 당일" 장면.
 * 실제 공연장 형상(실감형 콘텐츠) 위에 공연 당일 조건을 얹는다:
 * 객석 조명 꺼짐 · LED 전광판 · 무대 조명 · 실제 키(1.75m)의 출연자 · 60% 점유 관객(앉음/일어섬) · 응원봉.
 */
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { headAt, headVar, stageFrontX, type Seat, type StageConfig } from "@/lib/venue";

const SX = stageFrontX();

function hash(n: number, salt: number) {
  const x = Math.sin(n * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/* ── 관객 ─────────────────────────────────────────── */
export function Crowd({ seats, selected, standing }: { seats: Seat[]; selected: Seat; standing: boolean }) {
  const body = useRef<THREE.InstancedMesh>(null);
  const head = useRef<THREE.InstancedMesh>(null);
  const stick = useRef<THREE.InstancedMesh>(null);
  const people = useMemo(() => {
    const out: { s: Seat; i: number }[] = [];
    seats.forEach((s, i) => {
      if (s.id === selected.id) return;
      // 시야 계산(seatVisibility)과 같은 규칙: 눈 바로 옆 0.7m 안은 제외, 관객 배치는 같은 격자 해시(60%)
      const near = Math.hypot(s.pos[0] - selected.pos[0], s.pos[2] - selected.pos[2]);
      if (near < 0.75) return;
      if (headAt(s.pos[0], s.pos[2])) out.push({ s, i });
    });
    return out;
  }, [seats, selected]);
  // 눈앞 2m 안 응원봉은 화면을 덮어버려서 제외
  const sticks = useMemo(
    () => people.filter((p) => hash(p.i, 2) < 0.45 && Math.hypot(p.s.pos[0] - selected.pos[0], p.s.pos[2] - selected.pos[2]) > 2),
    [people, selected],
  );

  useEffect(() => {
    const o = new THREE.Object3D();
    const c = new THREE.Color();
    people.forEach(({ s, i }, k) => {
      // 머리 꼭대기 높이 = 시야 계산(blockAt)과 동일: 바닥 + (서면 1.75 / 앉으면 1.2) + 개인차
      const up = s.tier === "플로어" || standing;
      const ground = s.tier === "플로어" ? 0 : s.pos[1] - 0.4;
      const top = ground + (up ? 1.75 : 1.2) + headVar(s.pos[0], s.pos[2]);
      const torsoTop = top - 0.25;
      const torsoBottom = up ? ground + 0.9 : ground + 0.45;
      o.position.set(s.pos[0], (torsoTop + torsoBottom) / 2, s.pos[2]);
      o.rotation.set(0, 0, 0);
      o.scale.set(1, torsoTop - torsoBottom, 1);
      o.updateMatrix();
      body.current?.setMatrixAt(k, o.matrix);
      o.position.set(s.pos[0], top - 0.13, s.pos[2]);
      o.scale.set(1, 1.15, 1);
      o.updateMatrix();
      head.current?.setMatrixAt(k, o.matrix);
      c.setHSL(0.6, 0.12, 0.1 + hash(i, 4) * 0.06);
      body.current?.setColorAt(k, c);
      head.current?.setColorAt(k, c);
    });
    const palette = ["#ff4fa3", "#62a8ff", "#ffffff", "#ffd43b", "#a78bfa"];
    sticks.forEach(({ s, i }, k) => {
      const up = s.tier === "플로어" || standing;
      const side = hash(i, 5) < 0.5 ? -1 : 1;
      const dir = new THREE.Vector2(SX - s.pos[0], -s.pos[2]).normalize();
      const perp = new THREE.Vector2(-dir.y, dir.x);
      const ground = s.tier === "플로어" ? 0 : s.pos[1] - 0.4;
      o.position.set(s.pos[0] + perp.x * side * 0.25, ground + (up ? 1.55 : 1.05) + hash(i, 6) * 0.25, s.pos[2] + perp.y * side * 0.25);
      o.rotation.set(0, 0, 0);
      o.scale.set(1, 1, 1);
      o.updateMatrix();
      stick.current?.setMatrixAt(k, o.matrix);
      stick.current?.setColorAt(k, c.set(palette[Math.floor(hash(i, 7) * palette.length)]));
    });
    for (const m of [body.current, head.current, stick.current]) {
      if (!m) continue;
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
  }, [people, sticks, standing]);

  // 응원봉이 박자에 맞춰 조금씩 흔들리는 느낌 (색 밝기만 바꿈 — 가볍게)
  useFrame(({ clock }) => {
    const m = stick.current?.material as THREE.MeshBasicMaterial | undefined;
    // eslint-disable-next-line react-hooks/immutability -- three.js 객체는 프레임마다 직접 갱신
    if (m) m.opacity = 0.75 + Math.sin(clock.elapsedTime * 3.2) * 0.2;
  });

  return (
    <group>
      <instancedMesh ref={body} args={[undefined, undefined, people.length]} frustumCulled={false}>
        <cylinderGeometry args={[0.19, 0.23, 1, 7]} />
        <meshStandardMaterial roughness={1} />
      </instancedMesh>
      <instancedMesh ref={head} args={[undefined, undefined, people.length]} frustumCulled={false}>
        <sphereGeometry args={[0.115, 10, 8]} />
        <meshStandardMaterial roughness={1} />
      </instancedMesh>
      <instancedMesh ref={stick} args={[undefined, undefined, sticks.length]} frustumCulled={false}>
        <sphereGeometry args={[0.055, 8, 6]} />
        <meshBasicMaterial toneMapped={false} transparent />
      </instancedMesh>
    </group>
  );
}

/* ── 무대·전광판·조명 ─────────────────────────────── */
function useLedTexture() {
  const { canvas, tex } = useMemo(() => {
    const canvas = typeof document !== "undefined" ? document.createElement("canvas") : null;
    if (canvas) {
      canvas.width = 512;
      canvas.height = 256;
    }
    const tex = canvas ? new THREE.CanvasTexture(canvas) : null;
    if (tex) tex.colorSpace = THREE.SRGBColorSpace;
    return { canvas, tex };
  }, []);
  useFrame(({ clock }) => {
    if (!canvas || !tex) return;
    const g = canvas.getContext("2d")!;
    const t = clock.elapsedTime;
    const grd = g.createLinearGradient(0, 0, 512, 256);
    grd.addColorStop(0, `hsl(${(t * 18) % 360} 85% 45%)`);
    grd.addColorStop(1, `hsl(${(t * 18 + 140) % 360} 85% 30%)`);
    g.fillStyle = grd;
    g.fillRect(0, 0, 512, 256);
    // 화면 속 출연자 클로즈업 실루엣 (전광판으로 보면 이렇게 크게 보인다는 느낌)
    g.fillStyle = "rgba(10,12,20,0.85)";
    g.beginPath();
    g.ellipse(256, 108, 38, 46, 0, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.moveTo(150, 256);
    g.quadraticCurveTo(256, 150, 362, 256);
    g.fill();
    for (let i = 0; i < 14; i++) {
      g.fillStyle = `rgba(255,255,255,${0.05 + 0.05 * Math.sin(t * 2 + i)})`;
      g.fillRect(((i * 41 + t * 60) % 560) - 40, 0, 6, 256);
    }
    // eslint-disable-next-line react-hooks/immutability -- three.js 객체는 프레임마다 직접 갱신
    tex.needsUpdate = true;
  });
  return tex;
}

function Performers({ stage }: { stage: StageConfig }) {
  const g = useRef<THREE.Group>(null);
  const xs = [-2.5, 0, 2.5, -5, 5];
  useFrame(({ clock }) => {
    g.current?.children.forEach((c, i) => {
      c.position.z = xs[i] + Math.sin(clock.elapsedTime * 0.7 + i) * 0.8;
    });
  });
  return (
    <group ref={g} position={[SX - 2.5, stage.height, 0]}>
      {xs.map((z, i) => (
        <group key={i} position={[0, 0, z]}>
          <mesh position={[0, 0.55, 0]}>
            <capsuleGeometry args={[0.17, 0.75, 4, 8]} />
            <meshStandardMaterial color="#f1f3f5" emissive="#ffffff" emissiveIntensity={0.35} />
          </mesh>
          <mesh position={[0, 1.6, 0]}>
            <sphereGeometry args={[0.12, 12, 10]} />
            <meshStandardMaterial color="#f1f3f5" emissive="#ffffff" emissiveIntensity={0.35} />
          </mesh>
          <mesh position={[0, 0.2, 0]} scale={[0.12, 0.4, 0.12]}>
            <boxGeometry />
            <meshStandardMaterial color="#e9ecef" />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function Beams({ stage }: { stage: StageConfig }) {
  const g = useRef<THREE.Group>(null);
  const zs = [-9, -5.4, -1.8, 1.8, 5.4, 9];
  const colors = ["#7cb4ff", "#ff7ac6", "#ffffff", "#ffffff", "#ff7ac6", "#7cb4ff"];
  useFrame(({ clock }) => {
    g.current?.children.forEach((c, i) => {
      c.rotation.x = Math.sin(clock.elapsedTime * 0.6 + i) * 0.35;
      c.rotation.z = Math.cos(clock.elapsedTime * 0.45 + i * 1.3) * 0.25;
    });
  });
  const len = 15;
  return (
    <group ref={g}>
      {zs.map((z, i) => (
        <group key={z} position={[SX - stage.depth / 2, 16, z]}>
          <mesh position={[0, -len / 2, 0]}>
            <coneGeometry args={[2.2, len, 24, 1, true]} />
            <meshBasicMaterial
              color={colors[i]}
              transparent
              opacity={0.09}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
              side={THREE.DoubleSide}
              toneMapped={false}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}

export function ConcertStage({ stage }: { stage: StageConfig }) {
  const tex = useLedTexture();
  const cx = SX - stage.depth / 2;
  const ledW = stage.width * 0.8;
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.02, 0]}>
        <circleGeometry args={[23.5, 64]} />
        <meshStandardMaterial color="#0d1017" />
      </mesh>
      {/* 무대 */}
      <mesh position={[cx, stage.height / 2, 0]}>
        <boxGeometry args={[stage.depth, stage.height, stage.width]} />
        <meshStandardMaterial color="#1a1f2b" emissive="#2a3550" emissiveIntensity={0.5} />
      </mesh>
      {stage.type === "thrust" && stage.thrustLength > 0 && (
        <mesh position={[SX + stage.thrustLength / 2, stage.height / 2, 0]}>
          <boxGeometry args={[stage.thrustLength, stage.height, 5]} />
          <meshStandardMaterial color="#1a1f2b" emissive="#2a3550" emissiveIntensity={0.5} />
        </mesh>
      )}
      {/* 메인 LED */}
      <mesh position={[SX - stage.depth + 0.25, stage.height + stage.ledHeight / 2 + 0.5, 0]} rotation-y={Math.PI / 2}>
        <planeGeometry args={[ledW, stage.ledHeight]} />
        <meshBasicMaterial map={tex ?? undefined} toneMapped={false} />
      </mesh>
      {/* 양옆 중계 화면 */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[SX - 1, stage.height + 6.5, s * (stage.width / 2 + 5)]} rotation-y={Math.PI / 2 - s * 0.35}>
          <planeGeometry args={[7, 4]} />
          <meshBasicMaterial map={tex ?? undefined} toneMapped={false} />
        </mesh>
      ))}
      {/* 트러스 */}
      <mesh position={[cx, 16.2, 0]}>
        <boxGeometry args={[0.6, 0.6, stage.width + 6]} />
        <meshStandardMaterial color="#20242e" />
      </mesh>
      {stage.speakers &&
        [-1, 1].map((s) => (
          <mesh key={s} position={[SX - 0.8, 9.5, s * (stage.width / 2 + 1.8)]}>
            <boxGeometry args={[2.4, 7, 2.2]} />
            <meshStandardMaterial color="#05070b" />
          </mesh>
        ))}
      <mesh position={[8.25, 1.3, 0]}>
        <boxGeometry args={[4.5, 2.6, 7]} />
        <meshStandardMaterial color="#151922" />
      </mesh>
      <Performers stage={stage} />
      <Beams stage={stage} />
      <pointLight position={[cx + 8, 14, 0]} intensity={700} distance={50} color="#ffffff" />
      <pointLight position={[SX - 3, stage.height + 4, 0]} intensity={260} distance={60} color="#9cc3ff" />
    </group>
  );
}
