"use client";
/* eslint-disable react-hooks/immutability -- three.js 객체(행렬·텍스처·벡터)는 프레임마다 직접 갱신하는 것이 정상 */

/**
 * 좌석 1인칭 "공연 당일" 장면.
 * 실제 공연장 형상(실감형 콘텐츠) 위에 공연 당일 조건을 얹는다:
 * 객석 조명 꺼짐 · 픽셀 LED 전광판 · 트러스 조명과 빔(헤이즈) · 팔로우 스팟 · 실제 키(1.75m)의 출연자 ·
 * 60% 점유 관객(앉음/일어섬, 시야 계산과 같은 배치) · 흔드는 응원봉 · 블룸(빛 번짐).
 */
import { useFrame } from "@react-three/fiber";
import { Bloom, EffectComposer, Noise, Vignette } from "@react-three/postprocessing";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { headAt, headVar, stageFrontX, type Seat, type StageConfig } from "@/lib/venue";

const SX = stageFrontX();
const UP = new THREE.Vector3(0, 1, 0);

function hash(n: number, salt: number) {
  const x = Math.sin(n * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/* ── 사람 실루엣 (허리~머리, 높이 1로 정규화) ───────────────── */
function bustGeometry() {
  const pts = [
    [0.0, 0.0],
    [0.17, 0.0],
    [0.18, 0.2],
    [0.2, 0.38],
    [0.235, 0.5],
    [0.225, 0.56],
    [0.17, 0.6],
    [0.07, 0.63],
    [0.065, 0.67],
    [0.09, 0.7],
    [0.108, 0.77],
    [0.11, 0.84],
    [0.098, 0.92],
    [0.06, 0.975],
    [0.0, 1.0],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const g = new THREE.LatheGeometry(pts, 9);
  g.scale(1, 1, 0.62); // 어깨는 넓고 앞뒤는 얇게
  return g;
}

function personGeometry() {
  // 출연자용: 다리까지 있는 전신 (높이 1)
  const pts = [
    [0.0, 0.0],
    [0.09, 0.0],
    [0.1, 0.25],
    [0.13, 0.47],
    [0.15, 0.53],
    [0.13, 0.62],
    [0.15, 0.74],
    [0.135, 0.8],
    [0.05, 0.83],
    [0.055, 0.86],
    [0.07, 0.9],
    [0.07, 0.96],
    [0.04, 0.99],
    [0.0, 1.0],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const g = new THREE.LatheGeometry(pts, 12);
  g.scale(1, 1, 0.65);
  return g;
}

/* ── 관객 ─────────────────────────────────────────── */
export function Crowd({ seats, selected, standing }: { seats: Seat[]; selected: Seat; standing: boolean }) {
  const body = useRef<THREE.InstancedMesh>(null);
  const arm = useRef<THREE.InstancedMesh>(null);
  const stick = useRef<THREE.InstancedMesh>(null);
  const bust = useMemo(() => bustGeometry(), []);

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

  // 응원봉 든 사람: 눈앞 1.6m 안은 화면을 덮어서 제외
  const fans = useMemo(
    () =>
      people
        .filter((p) => hash(p.i, 2) < 0.5 && Math.hypot(p.s.pos[0] - selected.pos[0], p.s.pos[2] - selected.pos[2]) > 2.6)
        .map((p) => {
          const up = p.s.tier === "플로어" || standing;
          const ground = p.s.tier === "플로어" ? 0 : p.s.pos[1] - 0.4;
          const top = ground + (up ? 1.75 : 1.2) + headVar(p.s.pos[0], p.s.pos[2]);
          const dir = new THREE.Vector2(SX - p.s.pos[0], -p.s.pos[2]).normalize();
          const side = hash(p.i, 5) < 0.5 ? -1 : 1;
          const shoulder = new THREE.Vector3(p.s.pos[0] - dir.y * side * 0.19, top - 0.36, p.s.pos[2] + dir.x * side * 0.19);
          const raise = hash(p.i, 6); // 팔을 얼마나 올렸는지
          const hand = new THREE.Vector3(
            shoulder.x + dir.x * 0.18 - dir.y * side * 0.08,
            shoulder.y + 0.35 + raise * 0.3,
            shoulder.z - dir.y * 0.18 + dir.x * side * 0.08,
          );
          return { ...p, shoulder, hand, phase: hash(p.i, 8) * Math.PI * 2, dir };
        }),
    [people, selected, standing],
  );

  useEffect(() => {
    const o = new THREE.Object3D();
    const c = new THREE.Color();
    people.forEach(({ s, i }, k) => {
      // 머리 꼭대기 = 시야 계산(blockAt)과 동일: 바닥 + (서면 1.75 / 앉으면 1.2) + 개인차
      const up = s.tier === "플로어" || standing;
      const ground = s.tier === "플로어" ? 0 : s.pos[1] - 0.4;
      const top = ground + (up ? 1.75 : 1.2) + headVar(s.pos[0], s.pos[2]);
      const bottom = up ? ground + 0.85 : ground + 0.45;
      o.position.set(s.pos[0], bottom, s.pos[2]);
      o.rotation.set(0, Math.atan2(SX - s.pos[0], -s.pos[2]) + Math.PI / 2 + (hash(i, 9) - 0.5) * 0.5, 0);
      const w = 0.92 + hash(i, 3) * 0.18;
      o.scale.set(w, top - bottom, w);
      o.updateMatrix();
      body.current?.setMatrixAt(k, o.matrix);
      c.setHSL(0.62, 0.15, 0.035 + hash(i, 4) * 0.035);
      body.current?.setColorAt(k, c);
    });
    const palette = ["#ff5fb0", "#ff5fb0", "#6fb4ff", "#ffffff", "#ffe066"];
    fans.forEach((f, k) => {
      stick.current?.setColorAt(k, c.set(palette[Math.floor(hash(f.i, 7) * palette.length)]).multiplyScalar(2.4));
      arm.current?.setColorAt(k, c.setHSL(0.62, 0.15, 0.05));
    });
    for (const m of [body.current, arm.current, stick.current]) {
      if (!m) continue;
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
  }, [people, fans, standing]);

  // 응원봉 흔들기: 박자(약 120bpm)에 맞춰 손이 좌우로
  const o = useMemo(() => new THREE.Object3D(), []);
  const v = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const a = arm.current;
    const st = stick.current;
    if (!a || !st) return;
    fans.forEach((f, k) => {
      const sway = Math.sin(t * 4.2 + f.phase) * 0.14;
      const hx = f.hand.x - f.dir.y * sway;
      const hz = f.hand.z + f.dir.x * sway;
      v.set(hx - f.shoulder.x, f.hand.y - f.shoulder.y, hz - f.shoulder.z);
      const len = v.length();
      o.position.set((hx + f.shoulder.x) / 2, (f.hand.y + f.shoulder.y) / 2, (hz + f.shoulder.z) / 2);
      o.quaternion.setFromUnitVectors(UP, v.normalize());
      o.scale.set(1, len, 1);
      o.updateMatrix();
      a.setMatrixAt(k, o.matrix);
      o.position.set(hx, f.hand.y + 0.1, hz);
      o.scale.set(1, 1, 1);
      o.updateMatrix();
      st.setMatrixAt(k, o.matrix);
    });
    a.instanceMatrix.needsUpdate = true;
    st.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      <instancedMesh ref={body} args={[bust, undefined, people.length]} frustumCulled={false}>
        <meshStandardMaterial roughness={0.95} metalness={0} />
      </instancedMesh>
      <instancedMesh ref={arm} args={[undefined, undefined, fans.length]} frustumCulled={false}>
        <cylinderGeometry args={[0.04, 0.05, 1, 5]} />
        <meshStandardMaterial roughness={1} />
      </instancedMesh>
      <instancedMesh ref={stick} args={[undefined, undefined, fans.length]} frustumCulled={false}>
        <capsuleGeometry args={[0.03, 0.12, 2, 6]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
    </group>
  );
}

/* ── 전광판 영상 ─────────────────────────────────── */
function useLedTexture(w = 1024, h = 512) {
  const { canvas, tex } = useMemo(() => {
    const canvas = typeof document !== "undefined" ? document.createElement("canvas") : null;
    if (canvas) {
      canvas.width = w;
      canvas.height = h;
    }
    const tex = canvas ? new THREE.CanvasTexture(canvas) : null;
    if (tex) {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 4;
    }
    return { canvas, tex };
  }, [w, h]);
  const grid = useMemo(() => {
    if (typeof document === "undefined") return null;
    const c = document.createElement("canvas");
    c.width = 8;
    c.height = 8;
    const g = c.getContext("2d")!;
    g.fillStyle = "rgba(0,0,0,0.55)";
    g.fillRect(6, 0, 2, 8);
    g.fillRect(0, 6, 8, 2);
    return c;
  }, []);
  const last = useRef(0);
  useFrame(({ clock }) => {
    if (!canvas || !tex) return;
    const t = clock.elapsedTime;
    if (t - last.current < 1 / 24) return; // 24fps 영상
    last.current = t;
    const g = canvas.getContext("2d")!;
    // 배경: 무대 조명색이 흐르는 그라데이션
    const hue = (t * 12) % 360;
    const bg = g.createRadialGradient(w / 2, h * 0.45, 20, w / 2, h * 0.5, w * 0.7);
    bg.addColorStop(0, `hsl(${hue} 90% 55%)`);
    bg.addColorStop(0.5, `hsl(${(hue + 40) % 360} 85% 28%)`);
    bg.addColorStop(1, `hsl(${(hue + 80) % 360} 80% 8%)`);
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
    // 보케
    for (let i = 0; i < 18; i++) {
      const x = ((i * 173 + t * 40 * (1 + (i % 3))) % (w + 120)) - 60;
      const y = (i * 97) % h;
      const r = 18 + (i % 5) * 9;
      const b = g.createRadialGradient(x, y, 0, x, y, r);
      b.addColorStop(0, `hsla(${(hue + i * 20) % 360} 100% 85% / 0.55)`);
      b.addColorStop(1, "hsla(0 0% 100% / 0)");
      g.fillStyle = b;
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
    }
    // 중계 카메라 클로즈업: 마이크를 든 출연자 실루엣(역광)
    const sway = Math.sin(t * 0.9) * 18;
    g.save();
    g.translate(w / 2 + sway, 0);
    g.fillStyle = "rgba(6,7,12,0.96)";
    g.beginPath();
    g.ellipse(0, h * 0.4, 62, 78, 0, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.moveTo(-34, h * 0.52);
    g.lineTo(34, h * 0.52);
    g.lineTo(40, h * 0.62);
    g.quadraticCurveTo(190, h * 0.68, 230, h);
    g.lineTo(-230, h);
    g.quadraticCurveTo(-190, h * 0.68, -40, h * 0.62);
    g.closePath();
    g.fill();
    g.strokeStyle = `hsla(${(hue + 30) % 360} 100% 80% / 0.8)`;
    g.lineWidth = 4;
    g.beginPath();
    g.ellipse(0, h * 0.4, 63, 79, 0, Math.PI * 1.05, Math.PI * 1.95);
    g.stroke();
    g.fillStyle = "#1c1f27";
    g.fillRect(52, h * 0.44, 12, 70);
    g.beginPath();
    g.arc(58, h * 0.44, 15, 0, Math.PI * 2);
    g.fill();
    g.restore();
    // LED 픽셀 격자
    if (grid) {
      g.fillStyle = g.createPattern(grid, "repeat")!;
      g.fillRect(0, 0, w, h);
    }
    tex.needsUpdate = true;
  });
  return tex;
}

/* ── 무대 조명 빔 (끝으로 갈수록 옅어지는 원뿔) ─────────── */
const beamVert = /* glsl */ `
varying float vY;
varying vec3 vN;
varying vec3 vView;
void main() {
  vY = uv.y;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vN = normalize(mat3(modelMatrix) * normal);
  vView = normalize(cameraPosition - wp.xyz);
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;
const beamFrag = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
varying float vY;
varying vec3 vN;
varying vec3 vView;
void main() {
  float edge = pow(abs(dot(normalize(vN), normalize(vView))), 1.6);
  float fade = pow(vY, 1.7);
  gl_FragColor = vec4(uColor * 1.6, edge * fade * uOpacity);
}`;

function Beam({ color, opacity = 0.32, length = 18, radius = 2.6 }: { color: string; opacity?: number; length?: number; radius?: number }) {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uColor: { value: new THREE.Color(color) }, uOpacity: { value: opacity } },
        vertexShader: beamVert,
        fragmentShader: beamFrag,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      }),
    [color, opacity],
  );
  return (
    <mesh position={[0, -length / 2, 0]} material={mat}>
      <cylinderGeometry args={[0.12, radius, length, 32, 1, true]} />
    </mesh>
  );
}

function MovingHeads({ stage }: { stage: StageConfig }) {
  const g = useRef<THREE.Group>(null);
  const zs = [-10.5, -7, -3.5, 0, 3.5, 7, 10.5];
  const colors = ["#5aa2ff", "#ff4fa3", "#ffffff", "#c18cff", "#ffffff", "#ff4fa3", "#5aa2ff"];
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    g.current?.children.forEach((c, i) => {
      c.rotation.x = Math.sin(t * 0.55 + i * 0.9) * 0.42;
      c.rotation.z = -0.25 + Math.cos(t * 0.4 + i * 1.7) * 0.3;
    });
  });
  return (
    <group ref={g}>
      {zs.map((z, i) => (
        <group key={z} position={[SX - stage.depth * 0.55, 15.6, z]}>
          <mesh>
            <sphereGeometry args={[0.22, 12, 8]} />
            <meshBasicMaterial color={new THREE.Color(colors[i]).multiplyScalar(4)} toneMapped={false} />
          </mesh>
          <Beam color={colors[i]} length={16} radius={2.2} />
        </group>
      ))}
    </group>
  );
}

/** 무대 뒤에서 객석 쪽으로 쏘는 역광 빔 */
function BackLights({ stage }: { stage: StageConfig }) {
  const g = useRef<THREE.Group>(null);
  const zs = [-8, -4, 0, 4, 8];
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    g.current?.children.forEach((c, i) => {
      c.rotation.z = -1.15 + Math.sin(t * 0.35 + i) * 0.12;
      c.rotation.x = Math.sin(t * 0.5 + i * 1.3) * 0.25;
    });
  });
  return (
    <group ref={g}>
      {zs.map((z) => (
        <group key={z} position={[SX - stage.depth - 0.5, stage.height + 0.6, z]}>
          <mesh>
            <sphereGeometry args={[0.18, 10, 8]} />
            <meshBasicMaterial color={new THREE.Color("#ffffff").multiplyScalar(5)} toneMapped={false} />
          </mesh>
          <Beam color="#dfe8ff" opacity={0.18} length={30} radius={3.2} />
        </group>
      ))}
    </group>
  );
}

/** FOH 쪽에서 출연자를 따라가는 팔로우 스팟 */
function FollowSpot({ stage, target }: { stage: StageConfig; target: React.RefObject<THREE.Group | null> }) {
  const g = useRef<THREE.Group>(null);
  const from = useMemo(() => new THREE.Vector3(48, 15, 0), []);
  const to = useMemo(() => new THREE.Vector3(), []);
  const d = useMemo(() => new THREE.Vector3(), []);
  const down = useMemo(() => new THREE.Vector3(0, -1, 0), []);
  useFrame(() => {
    const p = target.current?.children[0];
    if (!p || !g.current) return;
    p.getWorldPosition(to);
    to.y = stage.height + 1;
    d.copy(to).sub(from);
    g.current.position.copy(from);
    const len = d.length();
    g.current.quaternion.setFromUnitVectors(down, d.normalize());
    g.current.scale.set(1, len / 60, 1);
  });
  return (
    <group ref={g}>
      <Beam color="#fff6e0" opacity={0.12} length={60} radius={0.9} />
    </group>
  );
}

function Performers({ stage, groupRef }: { stage: StageConfig; groupRef: React.RefObject<THREE.Group | null> }) {
  const geo = useMemo(() => personGeometry(), []);
  const zs = [0, -2.6, 2.6, -5.2, 5.2];
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    groupRef.current?.children.forEach((c, i) => {
      c.position.z = zs[i] + Math.sin(t * 0.6 + i * 1.7) * 0.9;
      c.position.y = Math.abs(Math.sin(t * 4.2 + i)) * 0.06;
    });
  });
  return (
    <group position={[SX - 2.2, stage.height, 0]}>
      <group ref={groupRef}>
        {zs.map((z, i) => (
          <mesh key={i} geometry={geo} position={[0, 0, z]} scale={[1, 1.75, 1]} rotation-y={-Math.PI / 2}>
            <meshStandardMaterial color={i === 0 ? "#ffffff" : "#d9dde6"} emissive="#ffffff" emissiveIntensity={i === 0 ? 0.9 : 0.45} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

/** 공중에 뜬 연기(헤이즈) */
function Haze({ stage }: { stage: StageConfig }) {
  const tex = useMemo(() => {
    if (typeof document === "undefined") return null;
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const g = c.getContext("2d")!;
    const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    r.addColorStop(0, "rgba(255,255,255,0.55)");
    r.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = r;
    g.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  }, []);
  const puffs = useMemo(
    () =>
      Array.from({ length: 16 }, (_, i) => ({
        p: [SX - stage.depth * 0.4 + hash(i, 1) * 14, 4 + hash(i, 2) * 10, (hash(i, 3) - 0.5) * 30] as [number, number, number],
        s: 9 + hash(i, 4) * 10,
        c: ["#4f7dff", "#ff4fa3", "#9a7bff"][i % 3],
      })),
    [stage.depth],
  );
  if (!tex) return null;
  return (
    <group>
      {puffs.map((u, i) => (
        <sprite key={i} position={u.p} scale={[u.s, u.s * 0.6, 1]}>
          <spriteMaterial map={tex} color={u.c} transparent opacity={0.16} blending={THREE.AdditiveBlending} depthWrite={false} />
        </sprite>
      ))}
    </group>
  );
}

export function ConcertStage({ stage }: { stage: StageConfig }) {
  const tex = useLedTexture();
  const side = useLedTexture(512, 288);
  const perf = useRef<THREE.Group>(null);
  const cx = SX - stage.depth / 2;
  const ledW = stage.width * 0.85;
  const ledColor = useMemo(() => new THREE.Color(1.5, 1.5, 1.5), []);
  const strip = useMemo(() => new THREE.Color("#7fb2ff").multiplyScalar(3), []);
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.02, 0]}>
        <circleGeometry args={[23.5, 64]} />
        <meshStandardMaterial color="#030305" roughness={1} />
      </mesh>
      {/* 무대 데크 + 앞면 LED 띠 */}
      <mesh position={[cx, stage.height / 2, 0]}>
        <boxGeometry args={[stage.depth, stage.height, stage.width]} />
        <meshStandardMaterial color="#0c0e14" roughness={0.4} metalness={0.3} />
      </mesh>
      <mesh position={[SX + 0.01, stage.height - 0.12, 0]} rotation-y={Math.PI / 2}>
        <planeGeometry args={[stage.width, 0.18]} />
        <meshBasicMaterial color={strip} toneMapped={false} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[cx, stage.height + 0.01, 0]}>
        <planeGeometry args={[stage.depth, stage.width]} />
        <meshStandardMaterial color="#141824" roughness={0.15} metalness={0.6} />
      </mesh>
      {/* 무대 뒤 계단식 단 */}
      {[0, 1, 2].map((k) => (
        <mesh key={k} position={[SX - stage.depth + 2.2 - k * 0.7, stage.height + 0.25 + k * 0.5, 0]}>
          <boxGeometry args={[0.7, 0.5 + k * 1, stage.width * 0.55 - k * 2]} />
          <meshStandardMaterial color="#10131b" roughness={0.5} metalness={0.3} />
        </mesh>
      ))}
      {stage.type === "thrust" && stage.thrustLength > 0 && (
        <>
          <mesh position={[SX + stage.thrustLength / 2, stage.height / 2, 0]}>
            <boxGeometry args={[stage.thrustLength, stage.height, 5]} />
            <meshStandardMaterial color="#0c0e14" />
          </mesh>
          {[-2.5, 2.5].map((z) => (
            <mesh key={z} position={[SX + stage.thrustLength / 2, stage.height - 0.1, z]}>
              <boxGeometry args={[stage.thrustLength, 0.12, 0.08]} />
              <meshBasicMaterial color={strip} toneMapped={false} />
            </mesh>
          ))}
        </>
      )}
      {/* 메인 LED (베젤 포함) */}
      <mesh position={[SX - stage.depth + 0.15, stage.height + stage.ledHeight / 2 + 0.6, 0]} rotation-y={Math.PI / 2}>
        <planeGeometry args={[ledW + 0.6, stage.ledHeight + 0.6]} />
        <meshStandardMaterial color="#050608" />
      </mesh>
      <mesh position={[SX - stage.depth + 0.2, stage.height + stage.ledHeight / 2 + 0.6, 0]} rotation-y={Math.PI / 2}>
        <planeGeometry args={[ledW, stage.ledHeight]} />
        <meshBasicMaterial map={tex ?? undefined} color={ledColor} toneMapped={false} />
      </mesh>
      {/* 양옆 중계 화면 (16:9) */}
      {[-1, 1].map((s) => (
        <group key={s} position={[SX - 1.5, stage.height + 7.5, s * (stage.width / 2 + 6)]} rotation-y={Math.PI / 2 - s * 0.32}>
          <mesh position={[0, 0, -0.05]}>
            <planeGeometry args={[8.4, 4.9]} />
            <meshStandardMaterial color="#050608" />
          </mesh>
          <mesh>
            <planeGeometry args={[8, 4.5]} />
            <meshBasicMaterial map={side ?? undefined} color={ledColor} toneMapped={false} />
          </mesh>
        </group>
      ))}
      {/* 트러스 */}
      {[-1, 1].map((s) => (
        <mesh key={`tx${s}`} position={[cx + s * stage.depth * 0.45, 16, 0]}>
          <boxGeometry args={[0.45, 0.45, stage.width + 8]} />
          <meshStandardMaterial color="#2a2e38" metalness={0.8} roughness={0.35} />
        </mesh>
      ))}
      {[-1, 1].map((s) => (
        <mesh key={`tz${s}`} position={[cx, 16, s * (stage.width / 2 + 4)]}>
          <boxGeometry args={[stage.depth * 0.9, 0.45, 0.45]} />
          <meshStandardMaterial color="#2a2e38" metalness={0.8} roughness={0.35} />
        </mesh>
      ))}
      {/* 매달린 라인어레이 스피커 */}
      {stage.speakers &&
        [-1, 1].map((s) =>
          Array.from({ length: 8 }, (_, k) => (
            <mesh key={`${s}-${k}`} position={[SX - 0.6 + k * 0.08, 13 - k * 0.62, s * (stage.width / 2 + 1.8)]} rotation-z={-k * 0.035}>
              <boxGeometry args={[1.3, 0.55, 1.6]} />
              <meshStandardMaterial color="#08090c" roughness={0.6} />
            </mesh>
          )),
        )}
      <mesh position={[8.25, 1.3, 0]}>
        <boxGeometry args={[4.5, 2.6, 7]} />
        <meshStandardMaterial color="#0b0d12" />
      </mesh>
      {/* 무대 앞 펜스 */}
      <mesh position={[SX + 1.6, 0.6, 0]}>
        <boxGeometry args={[0.1, 1.2, stage.width + 2]} />
        <meshStandardMaterial color="#1a1d24" metalness={0.6} roughness={0.4} />
      </mesh>
      <Performers stage={stage} groupRef={perf} />
      <MovingHeads stage={stage} />
      <BackLights stage={stage} />
      <FollowSpot stage={stage} target={perf} />
      <Haze stage={stage} />
      <pointLight position={[SX + 4, stage.height + 6, 0]} intensity={420} distance={70} decay={1.6} color="#9fb8ff" />
      <pointLight position={[SX - 2, stage.height + 3, 0]} intensity={500} distance={30} color="#ffd6f0" />
      <hemisphereLight args={["#2a3560", "#000000", 0.18]} />
    </group>
  );
}

/** 빛 번짐·비네팅·필름 그레인 */
export function ConcertPost() {
  return (
    // 8비트 버퍼: 반정밀도(HalfFloat)는 아주 밝은 픽셀이 Inf가 되어 블룸 전체가 까맣게 번지는 기기가 있음
    <EffectComposer multisampling={0} frameBufferType={THREE.UnsignedByteType}>
      <Bloom mipmapBlur luminanceThreshold={0.62} luminanceSmoothing={0.25} intensity={1.25} radius={0.75} />
      <Vignette eskil={false} offset={0.28} darkness={0.75} />
      <Noise opacity={0.022} />
    </EffectComposer>
  );
}
