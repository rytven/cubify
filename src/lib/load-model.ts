import {
  Box3,
  Color,
  DoubleSide,
  Group,
  Mesh,
  MeshStandardMaterial,
  Vector3,
  type BufferAttribute,
  type BufferGeometry,
  type Material,
  type Object3D,
  type Texture,
} from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";
import { STLLoader } from "three/addons/loaders/STLLoader.js";
import { extOf, isSupportedModel } from "@/lib/model-files";
import type { PreparedMesh } from "@/lib/voxelize";

export { extOf, isSupportedModel };

function textureToImageData(tex: Texture | null | undefined): ImageData | null {
  if (!tex?.image) return null;
  const img = tex.image as {
    data?: ArrayLike<number> | ArrayBufferView;
    width?: number;
    height?: number;
  };
  const width = img.width ?? 0;
  const height = img.height ?? 0;
  if (!width || !height) return null;
  if (img.data && (img.data as ArrayLike<number>).length >= width * height * 4) {
    const src = img.data as ArrayLike<number>;
    const copy = new Uint8ClampedArray(width * height * 4);
    const packed = src.length === width * height * 4;
    if (packed) {
      for (let i = 0; i < copy.length; i++) copy[i] = src[i] ?? 0;
    } else {
      return null;
    }
    return new ImageData(copy, width, height);
  }
  try {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img as CanvasImageSource, 0, 0);
    return ctx.getImageData(0, 0, width, height);
  } catch {
    return null;
  }
}

function materialsOf(mat: Material | Material[]): Material[] {
  return Array.isArray(mat) ? mat : [mat];
}

function colorOf(mat: Material): [number, number, number] {
  const c = (mat as MeshStandardMaterial).color as Color | undefined;
  if (c) return [c.r, c.g, c.b];
  return [0.82, 0.82, 0.8];
}

function mapOf(mat: Material): Texture | null {
  return (mat as MeshStandardMaterial).map ?? null;
}

function uvAttribute(geo: BufferGeometry, channel: number): BufferAttribute | null {
  if (channel <= 0) return (geo.getAttribute("uv") as BufferAttribute | undefined) ?? null;
  const named = geo.getAttribute(`uv${channel}`) as BufferAttribute | undefined;
  if (named) return named;
  if (channel === 1) return (geo.getAttribute("uv1") as BufferAttribute | undefined) ?? null;
  return (geo.getAttribute("uv") as BufferAttribute | undefined) ?? null;
}

function extractRange(
  mesh: Mesh,
  geo: BufferGeometry,
  mat: Material,
  start: number,
  count: number,
): PreparedMesh | null {
  const posAttr = geo.getAttribute("position") as BufferAttribute | undefined;
  if (!posAttr || count < 3) return null;
  const end = Math.min(posAttr.count, start + count);
  const nvert = end - start;
  const tris = Math.floor(nvert / 3);
  if (tris < 1) return null;
  const used = tris * 3;
  const world = new Vector3();
  const positions = new Float32Array(used * 3);
  for (let i = 0; i < used; i++) {
    const src = start + i;
    world.set(posAttr.getX(src), posAttr.getY(src), posAttr.getZ(src));
    mesh.localToWorld(world);
    positions[i * 3] = world.x;
    positions[i * 3 + 1] = world.y;
    positions[i * 3 + 2] = world.z;
  }
  const tex = mapOf(mat);
  const channel = tex && typeof tex.channel === "number" ? tex.channel : 0;
  const uvAttr = uvAttribute(geo, channel);
  let uvs: Float32Array | null = null;
  if (uvAttr) {
    uvs = new Float32Array(used * 2);
    for (let i = 0; i < used; i++) {
      const src = start + i;
      uvs[i * 2] = uvAttr.getX(src);
      uvs[i * 2 + 1] = uvAttr.getY(src);
    }
  }
  const colAttr = geo.getAttribute("color") as BufferAttribute | undefined;
  let colors: Float32Array | null = null;
  if (colAttr) {
    colors = new Float32Array(used * 3);
    const item = colAttr.itemSize;
    for (let i = 0; i < used; i++) {
      const src = start + i;
      colors[i * 3] = colAttr.getX(src);
      colors[i * 3 + 1] = colAttr.getY(src);
      colors[i * 3 + 2] = item > 2 ? colAttr.getZ(src) : colAttr.getY(src);
    }
  }
  return {
    positions,
    uvs,
    colors,
    baseColor: colorOf(mat),
    image: textureToImageData(tex),
    flipY: tex ? tex.flipY : true,
  };
}

export function prepareMeshes(root: Object3D): PreparedMesh[] {
  root.updateWorldMatrix(true, true);
  const out: PreparedMesh[] = [];
  root.traverse((child) => {
    if (!(child as Mesh).isMesh) return;
    const mesh = child as Mesh;
    const geo = mesh.geometry as BufferGeometry;
    if (!geo?.getAttribute("position")) return;
    const indexed = geo.index ? geo.toNonIndexed() : geo;
    const mats = materialsOf(mesh.material);
    const posCount = indexed.getAttribute("position")?.count ?? 0;
    const groups =
      indexed.groups.length > 0
        ? indexed.groups
        : [{ start: 0, count: posCount, materialIndex: 0 }];
    for (const g of groups) {
      const mat = mats[g.materialIndex ?? 0] ?? mats[0];
      if (!mat) continue;
      const prepared = extractRange(mesh, indexed, mat, g.start, g.count);
      if (prepared) out.push(prepared);
    }
    if (indexed !== geo) indexed.dispose();
  });
  return out;
}

export async function loadModelFile(file: File): Promise<{ group: Group; meshes: PreparedMesh[] }> {
  const ext = extOf(file.name);
  if (!isSupportedModel(file.name)) {
    throw new Error("Use a GLB, GLTF, OBJ, or STL file.");
  }
  const url = URL.createObjectURL(file);
  try {
    let group: Group;
    if (ext === "glb" || ext === "gltf") {
      const gltf = await new GLTFLoader().loadAsync(url);
      group = gltf.scene;
    } else if (ext === "obj") {
      const text = await file.text();
      group = new OBJLoader().parse(text);
    } else {
      const buffer = await file.arrayBuffer();
      const geo = new STLLoader().parse(buffer);
      const mesh = new Mesh(
        geo,
        new MeshStandardMaterial({
          color: 0xc8cfc4,
          roughness: 0.55,
          metalness: 0.05,
          side: DoubleSide,
        }),
      );
      group = new Group();
      group.add(mesh);
    }
    centerGroup(group);
    return { group, meshes: prepareMeshes(group) };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function centerGroup(group: Object3D) {
  group.updateWorldMatrix(true, true);
  const box = new Box3().setFromObject(group);
  group.position.x -= (box.min.x + box.max.x) / 2;
  group.position.y -= (box.min.y + box.max.y) / 2;
  group.position.z -= (box.min.z + box.max.z) / 2;
  group.updateWorldMatrix(true, true);
}
