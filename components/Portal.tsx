'use client';

import React, { useRef, useEffect, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Plane } from '@react-three/drei';
import * as THREE from 'three';
import { GestureState } from '@/lib/gestureRecognition';

const PORTAL_COLOR = '#FFB700';
const PORTAL_COLOR_DARK = '#FF6B00';
const PARTICLE_COUNT = 300;

interface PortalRingProps {
  scale: number;
  rotation: number;
  opacity: number;
  delay: number;
}

function PortalRing({ scale, rotation, opacity, delay }: PortalRingProps) {
  const ringRef = useRef<THREE.Group>(null);
  
  useFrame((state) => {
    if (ringRef.current) {
      ringRef.current.rotation.z = rotation + state.clock.elapsedTime * 0.5 + delay;
      ringRef.current.scale.set(scale, scale, scale);
    }
  });

  return (
    <group ref={ringRef}>
      <mesh>
        <torusGeometry args={[1, 0.08, 32, 100]} />
        <meshStandardMaterial
          color={PORTAL_COLOR}
          emissive={PORTAL_COLOR}
          emissiveIntensity={opacity}
          transparent
          opacity={Math.min(1, opacity)}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

interface ParticleSystemProps {
  intensity: number;
  rotation: number;
}

function ParticleSystem({ intensity, rotation }: ParticleSystemProps) {
  const particlesRef = useRef<THREE.Points>(null);
  const [particles] = useState(() => {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const velocities = new Float32Array(PARTICLE_COUNT * 3);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.random() * 1.5 + 0.5;
      const height = (Math.random() - 0.5) * 2;

      positions[i * 3] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = height;
      positions[i * 3 + 2] = Math.sin(angle) * radius;

      const vx = (Math.random() - 0.5) * 0.02;
      const vy = Math.random() * 0.02;
      const vz = (Math.random() - 0.5) * 0.02;

      velocities[i * 3] = vx;
      velocities[i * 3 + 1] = vy;
      velocities[i * 3 + 2] = vz;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return { geometry, velocities };
  });

  useFrame(() => {
    if (particlesRef.current) {
      const positions = particles.geometry.attributes.position.array as Float32Array;
      
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        positions[i * 3] += particles.velocities[i * 3] * intensity;
        positions[i * 3 + 1] += particles.velocities[i * 3 + 1] * intensity;
        positions[i * 3 + 2] += particles.velocities[i * 3 + 2] * intensity;

        // Reset particles that go too far
        const distance = Math.sqrt(
          positions[i * 3] ** 2 + positions[i * 3 + 2] ** 2
        );
        if (distance > 3 || Math.abs(positions[i * 3 + 1]) > 2) {
          const angle = Math.random() * Math.PI * 2;
          const radius = Math.random() * 0.5 + 0.2;
          positions[i * 3] = Math.cos(angle) * radius;
          positions[i * 3 + 1] = (Math.random() - 0.5) * 0.5;
          positions[i * 3 + 2] = Math.sin(angle) * radius;
        }
      }

      particles.geometry.attributes.position.needsUpdate = true;
      particlesRef.current.rotation.z = rotation;
    }
  });

  return (
    <points ref={particlesRef}>
      <bufferGeometry attach="geometry" {...particles.geometry} />
      <pointsMaterial
        size={0.04}
        color={PORTAL_COLOR}
        emissive={PORTAL_COLOR}
        emissiveIntensity={0.8}
        transparent
        opacity={0.6}
        sizeAttenuation
        toneMapped={false}
      />
    </points>
  );
}

interface PortalCoreProps {
  intensity: number;
}

function PortalCore({ intensity }: PortalCoreProps) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.scale.set(intensity * 0.8, intensity * 0.8, 1);
      meshRef.current.material.emissiveIntensity = intensity * 0.5;
    }
  });

  return (
    <mesh ref={meshRef} position={[0, 0, 0.1]}>
      <circleGeometry args={[1, 32]} />
      <meshStandardMaterial
        color={PORTAL_COLOR_DARK}
        emissive={PORTAL_COLOR_DARK}
        emissiveIntensity={0.3}
        transparent
        opacity={0.3}
        toneMapped={false}
      />
    </mesh>
  );
}

interface PortalProps {
  gestureState: GestureState;
}

function PortalContent({ gestureState }: PortalProps) {
  const groupRef = useRef<THREE.Group>(null);
  
  // Calculate portal scale based on pinch (0.2 to 2)
  const portalScale = 0.2 + gestureState.pinchAmount * 1.8;
  const ringIntensity = gestureState.isActive ? 1 : 0.3;
  
  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.position.x = (gestureState.handPosition.x - 0.5) * 3;
      groupRef.current.position.y = (0.5 - gestureState.handPosition.y) * 3;
      groupRef.current.rotation.z = gestureState.handRotation * (Math.PI / 180);
    }
  });

  return (
    <group ref={groupRef} scale={portalScale}>
      <PortalCore intensity={ringIntensity} />
      <PortalRing scale={1} rotation={0} opacity={ringIntensity} delay={0} />
      <PortalRing scale={1.3} rotation={Math.PI / 4} opacity={ringIntensity * 0.8} delay={0.5} />
      <PortalRing scale={1.6} rotation={Math.PI / 2} opacity={ringIntensity * 0.6} delay={1} />
      <PortalRing scale={1.9} rotation={(3 * Math.PI) / 4} opacity={ringIntensity * 0.4} delay={1.5} />
      <ParticleSystem intensity={gestureState.pinchAmount * 2} rotation={gestureState.handRotation * (Math.PI / 180)} />
    </group>
  );
}

export interface PortalViewProps {
  gestureState: GestureState;
}

export function PortalView({ gestureState }: PortalViewProps) {
  return (
    <Canvas
      camera={{ position: [0, 0, 5], fov: 50 }}
      style={{ width: '100%', height: '100%' }}
      gl={{
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance',
      }}
    >
      <color attach="background" args={['#000000']} />
      <ambientLight intensity={0.2} />
      <PortalContent gestureState={gestureState} />
    </Canvas>
  );
}
