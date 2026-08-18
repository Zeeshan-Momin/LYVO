import React, { Suspense, useRef, useState, useEffect, useCallback } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, ContactShadows, useGLTF } from "@react-three/drei";
import * as THREE from "three";

const MODEL_PATH = "/models/shoe.glb";

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(e, i) { console.error("HeroShoe:", e, i); }
  render() { return this.state.hasError ? this.props.fallback : this.props.children; }
}

function SneakerModel({ mouse }) {
  const { scene } = useGLTF(MODEL_PATH);
  const groupRef = useRef();
  const tiltX = useRef(0);
  const tiltY = useRef(0);

  useEffect(() => {
    if (!scene || scene.__lyvoNorm) return;
    scene.__lyvoNorm = true;
    const box = new THREE.Box3().setFromObject(scene);
    const center = new THREE.Vector3();
    box.getCenter(center);
    scene.position.copy(center).negate();
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);
    if (maxDim > 0) { const s = 1.0 / maxDim; scene.scale.set(s, s, s); }
    scene.traverse((child) => {
      if (!child.isMesh || !child.material) return;
      child.castShadow = true;
      child.receiveShadow = true;
      child.material.envMapIntensity = 2.2;
      const n = (child.material.name || "").toLowerCase();
      if (n.includes("sole"))   { child.material.color = new THREE.Color("#111111"); child.material.roughness = 0.85; child.material.metalness = 0.1; }
      else if (n.includes("laces"))  { child.material.color = new THREE.Color("#E5E5E5"); child.material.roughness = 0.8; }
      else if (n.includes("mesh"))   { child.material.color = new THREE.Color("#1A1A1A"); child.material.roughness = 0.75; }
      else if (n.includes("caps"))   { child.material.color = new THREE.Color("#0A0A0A"); child.material.roughness = 0.85; }
      else if (n.includes("inner"))  { child.material.color = new THREE.Color("#111111"); child.material.roughness = 0.8; }
      else if (n.includes("stripes") || child.name.toLowerCase().includes("brand")) { child.material.color = new THREE.Color("#E5E5E5"); child.material.metalness = 0.95; child.material.roughness = 0.05; }
      else if (n.includes("band"))   { child.material.color = new THREE.Color("#C0C0C0"); child.material.metalness = 0.9; child.material.roughness = 0.1; }
      else if (n.includes("patch"))  { child.material.color = new THREE.Color("#FFFFFF"); child.material.roughness = 0.5; }
      child.material.needsUpdate = true;
    });
  }, [scene]);

  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.getElapsedTime();
    const rockY   = Math.sin(t * 0.62) * (10 * Math.PI / 180);
    const rockX   = Math.sin(t * 0.38 + 1.2) * (3 * Math.PI / 180);
    const floatY  = Math.sin(t * 0.78) * 0.055;
    const breathe = 0.85 + Math.sin(t * 1.04) * 0.013;
    tiltX.current = THREE.MathUtils.lerp(tiltX.current, -mouse.current.y * 0.18, 0.04);
    tiltY.current = THREE.MathUtils.lerp(tiltY.current,  mouse.current.x * 0.22, 0.04);
    groupRef.current.rotation.x = 0.12 + rockX + tiltX.current;
    groupRef.current.rotation.y = -Math.PI / 1.5 + rockY + tiltY.current;
    groupRef.current.rotation.z = 0.18;
    groupRef.current.position.y = floatY;
    groupRef.current.scale.setScalar(breathe);
  });

  return (
    <group ref={groupRef} rotation={[0.12, -Math.PI / 1.5, 0.18]} scale={0.85}>
      <primitive object={scene} position={[0, 0, 0]} />
    </group>
  );
}

function SceneLighting() {
  const keyRef = useRef();
  const rimRef = useRef();
  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (keyRef.current) keyRef.current.intensity = 1.8 + Math.sin(t * 0.78) * 0.2;
    if (rimRef.current) rimRef.current.intensity = 0.55 + Math.sin(t * 0.78 + Math.PI) * 0.1;
  });
  return (
    <>
      <hemisphereLight skyColor="#ffffff" groundColor="#0f0f15" intensity={0.7} />
      <directionalLight ref={keyRef} position={[5, 10, 5]} intensity={1.8} castShadow shadow-mapSize={[1024, 1024]} shadow-bias={-0.0001} />
      <directionalLight ref={rimRef} position={[-5, 5, -5]} intensity={0.55} />
      <pointLight position={[3.5, 0.5, 0.8]} intensity={2.0} color="#ffffff" distance={5} decay={2.5} />
      <Environment preset="studio" />
    </>
  );
}

function DynamicShadow() {
  const opacityRef = useRef(0.45);
  const shadowRef = useRef();
  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    opacityRef.current = 0.38 + Math.sin(t * 0.78) * 0.09;
  });
  return <ContactShadows ref={shadowRef} position={[0, -0.52, 0]} opacity={0.42} scale={4.5} blur={2.5} far={1.0} color="#000000" />;
}

function ThreeLoader({ fallbackSrc }) {
  return (
    <div className="relative w-full max-w-xl mx-auto h-[350px] sm:h-[400px] md:h-[450px] lg:h-[500px] xl:h-[550px] flex flex-col items-center justify-center bg-transparent">
      <img src={fallbackSrc} alt="Loading..." className="absolute w-full max-w-md mx-auto opacity-20 blur-md" />
      <div className="relative z-10 flex flex-col items-center gap-3">
        <div className="w-12 h-12 border-[4px] border-white/10 border-t-acid rounded-full animate-spin" />
        <span className="font-mono text-[10px] tracking-[0.25em] text-acid uppercase animate-pulse">Loading 3D Showcase...</span>
      </div>
    </div>
  );
}

function ThreeCanvas() {
  const mouse = useRef({ x: 0, y: 0 });
  const containerRef = useRef(null);

  const handleMouseMove = useCallback((e) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    mouse.current.x = ((e.clientX - rect.left) / rect.width  - 0.5) * 2;
    mouse.current.y = ((e.clientY - rect.top)  / rect.height - 0.5) * 2;
  }, []);

  const handleMouseLeave = useCallback(() => { mouse.current = { x: 0, y: 0 }; }, []);

  useEffect(() => { useGLTF.preload(MODEL_PATH); }, []);

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="relative w-full max-w-xl mx-auto h-[350px] sm:h-[400px] md:h-[450px] lg:h-[500px] xl:h-[550px] flex items-center justify-center"
    >
      <div
        className="absolute pointer-events-none"
        style={{
          bottom: "8%", left: "50%", transform: "translateX(-50%)",
          width: "55%", height: "18%",
          background: "radial-gradient(ellipse, rgba(204,255,0,0.10) 0%, transparent 70%)",
          filter: "blur(18px)",
          animation: "glowPulse 8s ease-in-out infinite",
          zIndex: 1,
        }}
      />
      <Canvas
        shadows dpr={[1, 2]}
        camera={{ position: [0, 0.2, 3.2], fov: 42 }}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance", toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
        className="w-full h-full outline-none"
        style={{ animation: "fadeIn 1s cubic-bezier(0.16,1,0.3,1) forwards", opacity: 0, outline: "none" }}
      >
        <SceneLighting />
        <Suspense fallback={null}>
          <SneakerModel mouse={mouse} />
          <DynamicShadow />
        </Suspense>
      </Canvas>
      <style>{`
        @keyframes fadeIn    { to { opacity: 1; } }
        @keyframes glowPulse { 0%,100% { opacity:.6; transform:translateX(-50%) scaleX(1); } 50% { opacity:1; transform:translateX(-50%) scaleX(1.15); } }
      `}</style>
    </div>
  );
}

export default function HeroShoe() {
  const fallbackSrc = "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&q=90";
  const fallbackImage = (
    <div className="relative w-full max-w-xl mx-auto h-[350px] sm:h-[400px] md:h-[450px] lg:h-[500px] xl:h-[550px] flex items-center justify-center">
      <img src={fallbackSrc} alt="LYVO Sneaker" className="relative w-full max-w-xl mx-auto" style={{ animation: "heroFloat 9s ease-in-out infinite" }} />
      <style>{`@keyframes heroFloat { 0%,100%{transform:translateY(0) rotate3d(0,1,0,-5deg);} 50%{transform:translateY(-12px) rotate3d(0,1,0,8deg);} }`}</style>
    </div>
  );
  return (
    <ErrorBoundary fallback={fallbackImage}>
      <Suspense fallback={<ThreeLoader fallbackSrc={fallbackSrc} />}>
        <ThreeCanvas />
      </Suspense>
    </ErrorBoundary>
  );
}
