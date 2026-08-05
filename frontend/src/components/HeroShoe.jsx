import React, { Suspense, useRef, useState, useEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Environment, ContactShadows, useGLTF } from "@react-three/drei";
import * as THREE from "three";

// ════════════════════════════════════════════════════════════
// CONFIGURABLE MODEL PATH
// Change this variable path to load any future 3D product model
// (e.g. "/models/airvision.glb", "/models/runner.glb", etc.)
// ════════════════════════════════════════════════════════════
const MODEL_PATH = "/models/shoe.glb";

// ════════════════════════════════════════════════════════════
// ERROR BOUNDARY FALLBACK
// ════════════════════════════════════════════════════════════
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error("HeroShoe Error Boundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

// ════════════════════════════════════════════════════════════
// 3D SNEAKER MODEL COMPONENT
// ════════════════════════════════════════════════════════════
function SneakerModel({ hovered, setHovered, isInteractingRef }) {
  const { scene } = useGLTF(MODEL_PATH);
  const outerRef = useRef();
  const innerRef = useRef();
  const speedMultiplierRef = useRef(1);

  // Center geometry and normalize scale automatically on load
  useEffect(() => {
    if (scene && !scene.__isNormalized) {
      scene.__isNormalized = true;
      
      // Calculate geometric bounding box
      const box = new THREE.Box3().setFromObject(scene);
      const center = new THREE.Vector3();
      box.getCenter(center);
      
      // Shift model position so the true geometric center is at [0, 0, 0]
      scene.position.copy(center).negate();

      // Scale model so its largest dimension is exactly 1.0 unit
      const size = new THREE.Vector3();
      box.getSize(size);
      const maxDim = Math.max(size.x, size.y, size.z);
      if (maxDim > 0) {
        const scaleFactor = 1.0 / maxDim;
        scene.scale.set(scaleFactor, scaleFactor, scaleFactor);
      }
    }

    if (scene) {
      // Configure high-quality material rendering for shadows and PBR reflections
      scene.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          
          if (child.material) {
            child.material.envMapIntensity = 2.0;
            child.material.roughness = 0.55;
            child.material.metalness = 0.15;
            
            // Apply luxury matte black & silver metallic color scheme
            const matName = child.material.name ? child.material.name.toLowerCase() : "";
            if (MODEL_PATH.includes("shoe.glb")) {
              if (matName.includes("sole")) {
                child.material.color = new THREE.Color("#111111"); // Matte black sole
                child.material.roughness = 0.85;
                child.material.metalness = 0.1;
              } else if (matName.includes("laces")) {
                child.material.color = new THREE.Color("#E5E5E5"); // Silver-white laces
                child.material.roughness = 0.8;
              } else if (matName.includes("mesh")) {
                child.material.color = new THREE.Color("#1A1A1A"); // Deep graphite mesh
                child.material.roughness = 0.75;
              } else if (matName.includes("caps")) {
                child.material.color = new THREE.Color("#0A0A0A"); // Matte black toe cap
                child.material.roughness = 0.85;
              } else if (matName.includes("inner")) {
                child.material.color = new THREE.Color("#111111"); // Charcoal lining
                child.material.roughness = 0.8;
              } else if (matName.includes("stripes") || child.name.toLowerCase().includes("brand")) {
                child.material.color = new THREE.Color("#E5E5E5"); // Polished silver stripe
                child.material.metalness = 0.95;
                child.material.roughness = 0.05;
              } else if (matName.includes("band")) {
                child.material.color = new THREE.Color("#C0C0C0"); // Chrome metallic heel band
                child.material.metalness = 0.9;
                child.material.roughness = 0.1;
              } else if (matName.includes("patch")) {
                child.material.color = new THREE.Color("#FFFFFF"); // White logo patch
                child.material.roughness = 0.5;
              }
            }
            child.material.needsUpdate = true;
          }
        }
      });
    }
  }, [scene]);

  useFrame((state, delta) => {
    const t = state.clock.getElapsedTime();
    const isInteracting = isInteractingRef.current;

    // Smoothly decelerate/accelerate auto-rotation based on interaction
    const targetSpeed = isInteracting ? 0 : 1;
    speedMultiplierRef.current = THREE.MathUtils.lerp(
      speedMultiplierRef.current,
      targetSpeed,
      0.08
    );

    // Inner group rotates on Y-axis (continuous 360° rotation)
    if (innerRef.current) {
      // Rotate 360° (~10 seconds per revolution)
      const rotationSpeed = (2 * Math.PI / 10) * speedMultiplierRef.current * delta;
      innerRef.current.rotation.y += rotationSpeed;
    }

    // Outer group handles running pose bobbing & hover scale transitions
    if (outerRef.current) {
      // Bobbing (centered on Y=0)
      outerRef.current.position.y = Math.sin(t * 2.0) * 0.04;

      // Hover scale animation (base scale 1.15 for normalized model)
      const targetScale = hovered ? 1.25 : 1.15;
      const currentScale = outerRef.current.scale.x;
      const newScale = THREE.MathUtils.lerp(currentScale, targetScale, 0.1);
      outerRef.current.scale.set(newScale, newScale, newScale);
    }
  });

  return (
    /* Outer group sets the dynamic running pose tilt:
       - rotation.x = 0.12 (subtle tilt toe down)
       - rotation.z = 0.18 (subtle lift heel up)
       This creates a gorgeous balanced posture that looks proper from all spin angles.
    */
    <group ref={outerRef} rotation={[0.12, 0, 0.18]} scale={1.15}>
      {/* Inner group handles the slow horizontal Y-axis spin */}
      <group ref={innerRef} rotation={[0, -Math.PI / 1.5, 0]}>
        <primitive
          object={scene}
          position={[0, 0, 0]}
          onPointerOver={(e) => {
            e.stopPropagation();
            setHovered(true);
          }}
          onPointerOut={(e) => {
            e.stopPropagation();
            setHovered(false);
          }}
        />
      </group>
    </group>
  );
}

// ════════════════════════════════════════════════════════════
// LIGHTING AND ENVIRONMENT
// ════════════════════════════════════════════════════════════
function SceneLighting({ hovered }) {
  const lightRef = useRef();

  useFrame((state) => {
    // Increase light intensity subtly on hover
    if (lightRef.current) {
      const targetIntensity = hovered ? 2.5 : 1.8;
      lightRef.current.intensity = THREE.MathUtils.lerp(
        lightRef.current.intensity,
        targetIntensity,
        0.1
      );
    }
  });

  return (
    <>
      {/* Natural ambient color gradient (Sky white, ground dark slate) */}
      <hemisphereLight skyColor="#ffffff" groundColor="#0f0f15" intensity={0.7} />
      
      {/* Main direction key light casting shadows */}
      <directionalLight
        ref={lightRef}
        position={[5, 10, 5]}
        intensity={1.8}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0001}
      />
      
      {/* Soft back/fill light */}
      <directionalLight position={[-5, 5, -5]} intensity={0.6} />

      {/* Specular white point light casting highlights */}
      <pointLight position={[3.5, 0.5, 0.8]} intensity={2.0} color="#ffffff" distance={5} decay={2.5} />
      
      {/* High-quality studio environment reflections */}
      <Environment preset="studio" />
    </>
  );
}

// ════════════════════════════════════════════════════════════
// LIGHTWEIGHT LOADER COMPONENT
// ════════════════════════════════════════════════════════════
function ThreeLoader({ fallbackSrc }) {
  return (
    <div className="relative w-full max-w-xl mx-auto h-[350px] sm:h-[400px] md:h-[450px] lg:h-[500px] xl:h-[550px] flex flex-col items-center justify-center bg-transparent">
      {/* Static image placeholder behind loading spinner */}
      <img
        src={fallbackSrc}
        alt="Sneaker loading..."
        className="absolute w-full max-w-md mx-auto opacity-20 blur-md"
      />
      <div className="relative z-10 flex flex-col items-center gap-3">
        <div className="w-12 h-12 border-[4px] border-white/10 border-t-acid rounded-full animate-spin"></div>
        <span className="font-mono text-[10px] tracking-[0.25em] text-acid uppercase animate-pulse">
          Loading 3D Showcase...
        </span>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// MAIN CANVAS COMPONENT
// ════════════════════════════════════════════════════════════
function ThreeCanvas({ fallbackImage }) {
  const [hovered, setHovered] = useState(false);
  const isInteractingRef = useRef(false);

  // Pre-load the model to ensure it is in cache
  useEffect(() => {
    useGLTF.preload(MODEL_PATH);
  }, []);

  return (
    <div className="relative w-full max-w-xl mx-auto h-[350px] sm:h-[400px] md:h-[450px] lg:h-[500px] xl:h-[550px] flex items-center justify-center">
      <Canvas
        shadows
        dpr={[1, 2]} // limit to 2 for performance on mobile Retinas
        camera={{ position: [0, 0.25, 2.5], fov: 40 }}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: "high-performance",
          preserveDrawingBuffer: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.0
        }}
        className="w-full h-full cursor-grab active:cursor-grabbing opacity-0 animate-fade-in outline-none"
        style={{ 
          animation: "fadeIn 1s cubic-bezier(0.16, 1, 0.3, 1) forwards",
          outline: "none" 
        }}
      >
        <SceneLighting hovered={hovered} />
        
        <Suspense fallback={null}>
          <SneakerModel
            hovered={hovered}
            setHovered={setHovered}
            isInteractingRef={isInteractingRef}
          />
          <ContactShadows
            position={[0, -0.5, 0]}
            opacity={0.4}
            scale={5.0}
            blur={2.5}
            far={1.2}
          />
        </Suspense>

        <OrbitControls
          makeDefault
          enableZoom={false}
          enablePan={false}
          minPolarAngle={Math.PI / 3}
          maxPolarAngle={Math.PI / 1.7}
          onStart={() => {
            isInteractingRef.current = true;
          }}
          onEnd={() => {
            isInteractingRef.current = false;
          }}
        />
      </Canvas>

      <style>{`
        @keyframes fadeIn {
          to { opacity: 1; }
        }
      `}</style>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// PUBLIC API EXPORT (WITH ERROR BOUNDARY)
// ════════════════════════════════════════════════════════════
export default function HeroShoe() {
  const fallbackSrc = "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&q=90";
  
  const fallbackImage = (
    <div className="relative w-full max-w-xl mx-auto h-[350px] sm:h-[400px] md:h-[450px] lg:h-[500px] xl:h-[550px] flex items-center justify-center">
      <img
        src={fallbackSrc}
        alt="LYVO Sneaker Fallback"
        className="relative w-full max-w-xl mx-auto"
        style={{ animation: "bobbing 6s ease-in-out infinite" }}
      />
      <style>{`
        @keyframes bobbing {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-14px); }
        }
      `}</style>
    </div>
  );

  return (
    <ErrorBoundary fallback={fallbackImage}>
      <Suspense fallback={<ThreeLoader fallbackSrc={fallbackSrc} />}>
        <ThreeCanvas fallbackImage={fallbackImage} />
      </Suspense>
    </ErrorBoundary>
  );
}
