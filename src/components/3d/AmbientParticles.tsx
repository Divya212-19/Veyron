import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface ParticlesProps {
  count?: number;
}

function ParticleField({ count = 100 }: ParticlesProps) {
  const pointsRef = useRef<THREE.Points>(null);

  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 8;
      arr[i * 3 + 1] = (Math.random() - 0.5) * 8;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 8;
    }
    return arr;
  }, [count]);

  useFrame(() => {
    if (pointsRef.current) {
      pointsRef.current.rotation.x += 0.0001;
      pointsRef.current.rotation.y += 0.0002;
    }
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          array={positions}
          count={count}
          itemSize={3}
          args={[positions, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.04}
        color="#00E0FF"
        sizeAttenuation
        transparent
        opacity={0.6}
      />
    </points>
  );
}

export default function AmbientParticles({ count = 150 }: ParticlesProps) {
  return (
    <div className="absolute inset-0 w-full h-full pointer-events-none">
      <Canvas
        camera={{ position: [0, 0, 4], fov: 50 }}
        gl={{ antialias: true, alpha: true }}
      >
        <ParticleField count={count} />
      </Canvas>
    </div>
  );
}
