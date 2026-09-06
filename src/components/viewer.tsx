import { Bounds, Grid, OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import { Color, type InstancedMesh, Mesh, type MeshStandardMaterial, NoToneMapping, Object3D, SRGBColorSpace } from "three";
import { getSourceGroup } from "@/lib/model-cache";
import { useStudio } from "@/lib/store";
import type { VoxelResult } from "@/lib/voxelize";

function VoxelInstances({ result }: { result: VoxelResult }) {
  const meshRef = useRef<InstancedMesh>(null);
  const count = result.voxels.length;

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh || count === 0) return;
    const dummy = new Object3D();
    const color = new Color();
    const ox = -result.width / 2;
    const oy = -result.height / 2;
    const oz = -result.depth / 2;
    for (let i = 0; i < count; i++) {
      const v = result.voxels[i]!;
      dummy.position.set(v.x + 0.5 + ox, v.y + 0.5 + oy, v.z + 0.5 + oz);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      color.setRGB(v.r / 255, v.g / 255, v.b / 255, SRGBColorSpace);
      mesh.setColorAt(i, color);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [result, count]);

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, Math.max(count, 1)]}
      visible={count > 0}
      frustumCulled={false}
    >
      <boxGeometry args={[0.98, 0.98, 0.98]} />
      <meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  );
}

function OriginalModel({
  sourceRev,
  result,
  wire,
}: {
  sourceRev: number;
  result: VoxelResult | null;
  wire: boolean;
}) {
  const group = getSourceGroup();
  const clone = useMemo(() => {
    void sourceRev;
    return group?.clone(true) ?? null;
  }, [group, sourceRev]);

  useLayoutEffect(() => {
    if (!clone) return;
    clone.traverse((child) => {
      const mesh = child as Mesh;
      if (!mesh.isMesh) return;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      mesh.material = mats.map((raw) => {
        const mat = (raw as MeshStandardMaterial).clone();
        mat.wireframe = wire;
        mat.transparent = wire;
        mat.opacity = wire ? 0.35 : 1;
        mat.depthWrite = !wire;
        if (!wire) {
          mat.toneMapped = false;
        }
        return mat;
      });
      if (!Array.isArray(mesh.material) || mesh.material.length === 1) {
        mesh.material = (mesh.material as MeshStandardMaterial[])[0]!;
      }
    });
  }, [clone, wire]);

  if (!clone) return null;

  if (!result || !result.scale) {
    return <primitive object={clone} />;
  }

  const s = result.scale;
  const [minX, minY, minZ] = result.origin;
  const position: [number, number, number] = [
    0.5 - result.width / 2 - minX * s,
    0.5 - result.height / 2 - minY * s,
    0.5 - result.depth / 2 - minZ * s,
  ];
  const rotation: [number, number, number] = result.zUp ? [-Math.PI / 2, 0, 0] : [0, 0, 0];

  return (
    <group position={position} rotation={rotation} scale={s}>
      <primitive object={clone} />
    </group>
  );
}

function Scene() {
  const result = useStudio((s) => s.result);
  const viewMode = useStudio((s) => s.viewMode);
  const sourceRev = useStudio((s) => s.sourceRev);
  const showVoxels = viewMode !== "original" && !!result;
  const showOriginal = viewMode !== "voxels" || !result;
  const longest = result ? Math.max(result.width, result.height, result.depth) : 24;
  const fitKey = `${sourceRev}-${result?.width ?? 0}x${result?.height ?? 0}x${result?.depth ?? 0}-${viewMode}`;

  return (
    <>
      <color attach="background" args={["#0c0d0c"]} />
      <ambientLight intensity={0.85} />
      <hemisphereLight args={["#f2f0ea", "#3a3a36", 0.35]} />
      <directionalLight position={[10, 16, 8]} intensity={0.9} />
      <directionalLight position={[-8, 6, -10]} intensity={0.22} />
      <Grid
        infiniteGrid
        fadeDistance={Math.max(72, longest * 2.2)}
        fadeStrength={1.2}
        sectionSize={8}
        cellSize={1}
        sectionColor="#2a2d2a"
        cellColor="#1c1f1c"
        position={[0, result ? -result.height / 2 - 0.01 : -1.2, 0]}
      />
      <Bounds key={fitKey} fit observe margin={1.35}>
        <group>
          {showVoxels && result ? <VoxelInstances result={result} /> : null}
          {showOriginal ? (
            <OriginalModel sourceRev={sourceRev} result={result} wire={viewMode === "both"} />
          ) : null}
        </group>
      </Bounds>
      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.08}
        minDistance={1}
        maxDistance={Math.max(180, longest * 8)}
      />
    </>
  );
}

export function Viewer() {
  return (
    <Canvas
      dpr={[1, 2]}
      camera={{
        position: [18, 14, 22],
        fov: 42,
        near: 0.1,
        far: 8000,
      }}
      gl={{ antialias: true, alpha: false, toneMapping: NoToneMapping }}
      style={{ width: "100%", height: "100%", touchAction: "none" }}
    >
      <Scene />
    </Canvas>
  );
}
