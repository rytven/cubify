import { clampByte, luma8 } from "@/lib/color";
import {
  nearestBlock,
  VOID_LUMA,
  type McBlock,
  type PalettePack,
} from "@/lib/minecraft-palette";

export interface PreparedMesh {
  positions: Float32Array;
  uvs: Float32Array | null;
  colors: Float32Array | null;
  baseColor: [number, number, number];
  image: ImageData | null;
  /** glTF atlases are top-left (flipY false). Three's default textures are OpenGL-flipped. */
  flipY: boolean;
}

export interface Voxel {
  x: number;
  y: number;
  z: number;
  r: number;
  g: number;
  b: number;
  block: string;
}

export interface BlockCount {
  id: string;
  name: string;
  rgb: [number, number, number];
  count: number;
}

export interface VoxelResult {
  width: number;
  height: number;
  depth: number;
  scale: number;
  origin: [number, number, number];
  zUp: boolean;
  voxels: Voxel[];
  counts: BlockCount[];
}

export interface VoxelizeOptions {
  resolution: number;
  hollow: boolean;
  dither: boolean;
  pack: PalettePack;
  colorMode: "minecraft" | "original";
  zUp: boolean;
  /** Recover albedo on photogrammetry scans (baked shade + black atlas padding). */
  liftShadows: boolean;
  signal?: { cancelled: boolean };
  onProgress?: (value: number) => void;
}

type Vec3 = [number, number, number];

function sub(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}
function add(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}
function scale(a: Vec3, s: number): Vec3 {
  return [a[0] * s, a[1] * s, a[2] * s];
}
function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function closestPointOnTriangle(p: Vec3, a: Vec3, b: Vec3, c: Vec3): Vec3 {
  const ab = sub(b, a);
  const ac = sub(c, a);
  const ap = sub(p, a);
  const d1 = dot(ab, ap);
  const d2 = dot(ac, ap);
  if (d1 <= 0 && d2 <= 0) return a;
  const bp = sub(p, b);
  const d3 = dot(ab, bp);
  const d4 = dot(ac, bp);
  if (d3 >= 0 && d4 <= d3) return b;
  const vc = d1 * d4 - d3 * d2;
  if (vc <= 0 && d1 >= 0 && d3 <= 0) {
    const v = d1 / (d1 - d3);
    return add(a, scale(ab, v));
  }
  const cp = sub(p, c);
  const d5 = dot(ab, cp);
  const d6 = dot(ac, cp);
  if (d6 >= 0 && d5 <= d6) return c;
  const vb = d5 * d2 - d1 * d6;
  if (vb <= 0 && d2 >= 0 && d6 <= 0) {
    const w = d2 / (d2 - d6);
    return add(a, scale(ac, w));
  }
  const va = d3 * d6 - d5 * d4;
  if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) {
    const w = (d4 - d3) / (d4 - d3 + (d5 - d6));
    return add(b, scale(sub(c, b), w));
  }
  const denom = 1 / (va + vb + vc);
  return add(a, add(scale(ab, vb * denom), scale(ac, vc * denom)));
}

function barycentric(p: Vec3, a: Vec3, b: Vec3, c: Vec3): Vec3 {
  const v0 = sub(b, a);
  const v1 = sub(c, a);
  const v2 = sub(p, a);
  const d00 = dot(v0, v0);
  const d01 = dot(v0, v1);
  const d11 = dot(v1, v1);
  const d20 = dot(v2, v0);
  const d21 = dot(v2, v1);
  const denom = d00 * d11 - d01 * d01;
  if (Math.abs(denom) < 1e-12) return [1, 0, 0];
  const v = (d11 * d20 - d01 * d21) / denom;
  const w = (d00 * d21 - d01 * d20) / denom;
  return [1 - v - w, v, w];
}

function sampleImage(
  image: ImageData,
  u: number,
  v: number,
  flipY: boolean,
): [number, number, number, number] {
  const wu = Math.min(1, Math.max(0, u));
  let wv = Math.min(1, Math.max(0, v));
  if (flipY) wv = 1 - wv;
  const fx = wu * (image.width - 1);
  const fy = wv * (image.height - 1);
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const x1 = Math.min(image.width - 1, x0 + 1);
  const y1 = Math.min(image.height - 1, y0 + 1);
  const tx = fx - x0;
  const ty = fy - y0;
  const pix = (x: number, y: number) => {
    const i = (y * image.width + x) * 4;
    return [image.data[i]!, image.data[i + 1]!, image.data[i + 2]!, image.data[i + 3]!] as const;
  };
  const a = pix(x0, y0);
  const b = pix(x1, y0);
  const c = pix(x0, y1);
  const d = pix(x1, y1);
  const mix = (i: number) => {
    const top = a[i] + (b[i] - a[i]) * tx;
    const bot = c[i] + (d[i] - c[i]) * tx;
    return top + (bot - top) * ty;
  };
  return [mix(0), mix(1), mix(2), mix(3)];
}

function yieldToMain(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function idx(x: number, y: number, z: number, w: number, d: number): number {
  return x + z * w + y * w * d;
}

function decode(i: number, w: number, d: number): [number, number, number] {
  const x = i % w;
  const t = (i / w) | 0;
  const z = t % d;
  const y = (t / d) | 0;
  return [x, y, z];
}

/** Lift luma only so photogrammetry hue/saturation stay intact. */
function liftRgb(r: number, g: number, b: number, amount: number): [number, number, number] {
  if (amount <= 0) return [r, g, b];
  const l = luma8(r, g, b);
  const n = l / 255;
  const lifted = n + amount * (1 - n) * (1 - n);
  const gain = lifted / Math.max(n, 1 / 255);
  return [clampByte(r * gain), clampByte(g * gain), clampByte(b * gain)];
}

function shadowAmountFromHist(hist: Uint32Array, total: number): number {
  if (total < 8) return 0;
  const targetCount = total * 0.08;
  let acc = 0;
  let p08 = 0;
  for (let i = 0; i < 256; i++) {
    acc += hist[i]!;
    if (acc >= targetCount) {
      p08 = i;
      break;
    }
  }
  const target = 62 / 255;
  const n = p08 / 255;
  if (n >= target) return 0;
  const denom = (1 - n) * (1 - n);
  if (denom < 1e-6) return 0;
  return Math.min(0.42, (target - n) / denom);
}

function inpaintMissingColors(
  occ: Uint8Array,
  accR: Float32Array,
  accG: Float32Array,
  accB: Float32Array,
  accN: Float32Array,
  width: number,
  height: number,
  depth: number,
  fallback: [number, number, number],
) {
  const missing: number[] = [];
  for (let i = 0; i < occ.length; i++) {
    if (occ[i] && accN[i] === 0) missing.push(i);
  }
  for (const i of missing) {
    const [x, y, z] = decode(i, width, depth);
    let found = false;
    for (let r = 1; r <= 4 && !found; r++) {
      for (let dy = -r; dy <= r && !found; dy++) {
        for (let dz = -r; dz <= r && !found; dz++) {
          for (let dx = -r; dx <= r && !found; dx++) {
            const xx = x + dx;
            const yy = y + dy;
            const zz = z + dz;
            if (xx < 0 || yy < 0 || zz < 0 || xx >= width || yy >= height || zz >= depth) continue;
            const j = idx(xx, yy, zz, width, depth);
            if (occ[j] && accN[j]! > 0) {
              accR[i] = accR[j]!;
              accG[i] = accG[j]!;
              accB[i] = accB[j]!;
              accN[i] = accN[j]!;
              found = true;
            }
          }
        }
      }
    }
    if (!found) {
      accR[i] = fallback[0];
      accG[i] = fallback[1];
      accB[i] = fallback[2];
      accN[i] = 1;
    }
  }
}

export async function voxelize(
  meshes: PreparedMesh[],
  options: VoxelizeOptions,
): Promise<VoxelResult> {
  const { resolution, hollow, dither, pack, colorMode, zUp, liftShadows, signal, onProgress } =
    options;

  let minX = Infinity,
    minY = Infinity,
    minZ = Infinity;
  let maxX = -Infinity,
    maxY = -Infinity,
    maxZ = -Infinity;

  const rotated: PreparedMesh[] = meshes.map((mesh) => {
    const pos = new Float32Array(mesh.positions);
    if (zUp) {
      for (let i = 0; i < pos.length; i += 3) {
        const y = pos[i + 1]!;
        const z = pos[i + 2]!;
        pos[i + 1] = z;
        pos[i + 2] = -y;
      }
    }
    for (let i = 0; i < pos.length; i += 3) {
      const x = pos[i]!;
      const y = pos[i + 1]!;
      const z = pos[i + 2]!;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (z < minZ) minZ = z;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
      if (z > maxZ) maxZ = z;
    }
    return { ...mesh, positions: pos };
  });

  if (!Number.isFinite(minX)) {
    return {
      width: 1,
      height: 1,
      depth: 1,
      scale: 1,
      origin: [0, 0, 0],
      zUp,
      voxels: [],
      counts: [],
    };
  }

  const sizeX = Math.max(maxX - minX, 1e-6);
  const sizeY = Math.max(maxY - minY, 1e-6);
  const sizeZ = Math.max(maxZ - minZ, 1e-6);
  const maxSize = Math.max(sizeX, sizeY, sizeZ);
  let scaleV = resolution / maxSize;
  let width = Math.max(1, Math.ceil(sizeX * scaleV));
  let height = Math.max(1, Math.ceil(sizeY * scaleV));
  let depth = Math.max(1, Math.ceil(sizeZ * scaleV));
  let cellCount = width * height * depth;
  const MAX_CELLS = 10_000_000;
  if (cellCount > MAX_CELLS) {
    scaleV *= Math.cbrt(MAX_CELLS / cellCount);
    width = Math.max(1, Math.ceil(sizeX * scaleV));
    height = Math.max(1, Math.ceil(sizeY * scaleV));
    depth = Math.max(1, Math.ceil(sizeZ * scaleV));
    cellCount = width * height * depth;
  }
  const origin: [number, number, number] = [minX, minY, minZ];
  const occ = new Uint8Array(cellCount);
  const accR = new Float32Array(cellCount);
  const accG = new Float32Array(cellCount);
  const accB = new Float32Array(cellCount);
  const accN = new Float32Array(cellCount);
  const accD = new Float32Array(cellCount);
  accD.fill(1e12);

  let triTotal = 0;
  for (const mesh of rotated) triTotal += mesh.positions.length / 9;
  let triDone = 0;
  const dist2Max = 0.85 * 0.85;
  const holeLuma = liftShadows ? 8 : 3;
  const yieldEvery = resolution >= 160 ? 40 : resolution >= 96 ? 80 : 250;

  for (const mesh of rotated) {
    const pos = mesh.positions;
    const tris = pos.length / 9;
    for (let t = 0; t < tris; t++) {
      if (signal?.cancelled) {
        return {
          width,
          height,
          depth,
          scale: scaleV,
          origin,
          zUp,
          voxels: [],
          counts: [],
        };
      }
      const o = t * 9;
      const a: Vec3 = [
        (pos[o]! - minX) * scaleV,
        (pos[o + 1]! - minY) * scaleV,
        (pos[o + 2]! - minZ) * scaleV,
      ];
      const b: Vec3 = [
        (pos[o + 3]! - minX) * scaleV,
        (pos[o + 4]! - minY) * scaleV,
        (pos[o + 5]! - minZ) * scaleV,
      ];
      const c: Vec3 = [
        (pos[o + 6]! - minX) * scaleV,
        (pos[o + 7]! - minY) * scaleV,
        (pos[o + 8]! - minZ) * scaleV,
      ];
      const minTx = Math.max(0, Math.floor(Math.min(a[0], b[0], c[0]) - 1));
      const minTy = Math.max(0, Math.floor(Math.min(a[1], b[1], c[1]) - 1));
      const minTz = Math.max(0, Math.floor(Math.min(a[2], b[2], c[2]) - 1));
      const maxTx = Math.min(width - 1, Math.ceil(Math.max(a[0], b[0], c[0]) + 1));
      const maxTy = Math.min(height - 1, Math.ceil(Math.max(a[1], b[1], c[1]) + 1));
      const maxTz = Math.min(depth - 1, Math.ceil(Math.max(a[2], b[2], c[2]) + 1));

      const uvOff = t * 6;
      const colOff = t * 9;

      for (let y = minTy; y <= maxTy; y++) {
        for (let z = minTz; z <= maxTz; z++) {
          for (let x = minTx; x <= maxTx; x++) {
            const p: Vec3 = [x + 0.5, y + 0.5, z + 0.5];
            const q = closestPointOnTriangle(p, a, b, c);
            const dx = p[0] - q[0];
            const dy = p[1] - q[1];
            const dz = p[2] - q[2];
            const dist2 = dx * dx + dy * dy + dz * dz;
            if (dist2 > dist2Max) continue;
            const i = idx(x, y, z, width, depth);
            occ[i] = 1;
            const bary = barycentric(q, a, b, c);
            const ib0 = bary[0] * 0.88 + 0.12 / 3;
            const ib1 = bary[1] * 0.88 + 0.12 / 3;
            const ib2 = bary[2] * 0.88 + 0.12 / 3;
            let cr = mesh.baseColor[0] * 255;
            let cg = mesh.baseColor[1] * 255;
            let cb = mesh.baseColor[2] * 255;
            if (mesh.colors) {
              cr =
                (mesh.colors[colOff]! * bary[0] +
                  mesh.colors[colOff + 3]! * bary[1] +
                  mesh.colors[colOff + 6]! * bary[2]) *
                255;
              cg =
                (mesh.colors[colOff + 1]! * bary[0] +
                  mesh.colors[colOff + 4]! * bary[1] +
                  mesh.colors[colOff + 7]! * bary[2]) *
                255;
              cb =
                (mesh.colors[colOff + 2]! * bary[0] +
                  mesh.colors[colOff + 5]! * bary[1] +
                  mesh.colors[colOff + 8]! * bary[2]) *
                255;
            }
            let alpha = 255;
            if (mesh.image && mesh.uvs) {
              const u =
                mesh.uvs[uvOff]! * ib0 + mesh.uvs[uvOff + 2]! * ib1 + mesh.uvs[uvOff + 4]! * ib2;
              const v =
                mesh.uvs[uvOff + 1]! * ib0 + mesh.uvs[uvOff + 3]! * ib1 + mesh.uvs[uvOff + 5]! * ib2;
              const s = sampleImage(mesh.image, u, v, mesh.flipY);
              cr = s[0] * mesh.baseColor[0];
              cg = s[1] * mesh.baseColor[1];
              cb = s[2] * mesh.baseColor[2];
              alpha = s[3];
            }
            if (alpha < 12 || luma8(cr, cg, cb) < holeLuma) continue;
            if (accN[i]! > 0 && dist2 >= accD[i]!) continue;
            accD[i] = dist2;
            accR[i] = cr;
            accG[i] = cg;
            accB[i] = cb;
            accN[i] = 1;
          }
        }
      }

      triDone++;
      if (triDone % yieldEvery === 0) {
        onProgress?.(0.05 + 0.7 * (triDone / Math.max(1, triTotal)));
        await yieldToMain();
      }
    }
  }

  onProgress?.(0.78);

  if (!hollow) {
    const outside = new Uint8Array(cellCount);
    const stack: number[] = [];
    const tryPush = (x: number, y: number, z: number) => {
      if (x < 0 || y < 0 || z < 0 || x >= width || y >= height || z >= depth) return;
      const i = idx(x, y, z, width, depth);
      if (occ[i] || outside[i]) return;
      outside[i] = 1;
      stack.push(i);
    };
    for (let y = 0; y < height; y++) {
      for (let z = 0; z < depth; z++) {
        tryPush(0, y, z);
        tryPush(width - 1, y, z);
      }
    }
    for (let x = 0; x < width; x++) {
      for (let z = 0; z < depth; z++) {
        tryPush(x, 0, z);
        tryPush(x, height - 1, z);
      }
    }
    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        tryPush(x, y, 0);
        tryPush(x, y, depth - 1);
      }
    }
    while (stack.length) {
      const i = stack.pop()!;
      const [x, y, z] = decode(i, width, depth);
      tryPush(x - 1, y, z);
      tryPush(x + 1, y, z);
      tryPush(x, y - 1, z);
      tryPush(x, y + 1, z);
      tryPush(x, y, z - 1);
      tryPush(x, y, z + 1);
    }
    for (let i = 0; i < cellCount; i++) {
      if (!occ[i] && !outside[i]) {
        occ[i] = 2;
      }
    }
  }

  let meanR = 0;
  let meanG = 0;
  let meanB = 0;
  let meanN = 0;
  const hist = new Uint32Array(256);
  for (let i = 0; i < cellCount; i++) {
    if (!occ[i] || accN[i]! <= 0) continue;
    const n = accN[i]!;
    const r = accR[i]! / n;
    const g = accG[i]! / n;
    const b = accB[i]! / n;
    meanR += r;
    meanG += g;
    meanB += b;
    meanN += 1;
    hist[clampByte(luma8(r, g, b))]++;
  }
  const fallback: [number, number, number] =
    meanN > 0
      ? [meanR / meanN, meanG / meanN, meanB / meanN]
      : [142, 138, 128];
  inpaintMissingColors(occ, accR, accG, accB, accN, width, height, depth, fallback);

  const liftAmount = liftShadows ? shadowAmountFromHist(hist, meanN) : 0;

  onProgress?.(0.88);

  const matchCache = new Map<number, McBlock>();
  const albedoCache = new Map<number, McBlock>();
  const errR = dither ? new Float32Array(cellCount) : null;
  const errG = dither ? new Float32Array(cellCount) : null;
  const errB = dither ? new Float32Array(cellCount) : null;
  const voxels: Voxel[] = [];
  const countMap = new Map<string, BlockCount>();

  const neighbors: Array<[number, number, number, number]> = dither
    ? [
        [1, 0, 0, 4 / 16],
        [-1, 0, 1, 2 / 16],
        [0, 0, 1, 2 / 16],
        [1, 0, 1, 1 / 16],
        [0, 1, 0, 4 / 16],
        [0, 1, 1, 3 / 16],
      ]
    : [];

  for (let y = 0; y < height; y++) {
    for (let z = 0; z < depth; z++) {
      for (let x = 0; x < width; x++) {
        const i = idx(x, y, z, width, depth);
        if (!occ[i]) continue;
        const n = Math.max(accN[i]!, 1);
        let r = accR[i]! / n;
        let g = accG[i]! / n;
        let b = accB[i]! / n;
        [r, g, b] = liftRgb(r, g, b, liftAmount);
        const displayR = clampByte(r);
        const displayG = clampByte(g);
        const displayB = clampByte(b);
        let mr = r + (errR?.[i] ?? 0);
        let mg = g + (errG?.[i] ?? 0);
        let mb = b + (errB?.[i] ?? 0);
        mr = Math.min(255, Math.max(0, mr));
        mg = Math.min(255, Math.max(0, mg));
        mb = Math.min(255, Math.max(0, mb));
        const srcLuma = luma8(mr, mg, mb);
        const skipDark = liftShadows && srcLuma > VOID_LUMA + 8;
        const block = nearestBlock(
          mr,
          mg,
          mb,
          pack,
          skipDark ? albedoCache : matchCache,
          skipDark,
        );
        const outR = colorMode === "minecraft" ? block.rgb[0] : displayR;
        const outG = colorMode === "minecraft" ? block.rgb[1] : displayG;
        const outB = colorMode === "minecraft" ? block.rgb[2] : displayB;
        if (dither && errR && errG && errB) {
          const dr = mr - block.rgb[0];
          const dg = mg - block.rgb[1];
          const db = mb - block.rgb[2];
          for (const [dx, dy, dz, w] of neighbors) {
            const xx = x + dx;
            const yy = y + dy;
            const zz = z + dz;
            if (xx < 0 || yy < 0 || zz < 0 || xx >= width || yy >= height || zz >= depth)
              continue;
            const j = idx(xx, yy, zz, width, depth);
            errR[j] += dr * w;
            errG[j] += dg * w;
            errB[j] += db * w;
          }
        }
        voxels.push({
          x,
          y,
          z,
          r: outR,
          g: outG,
          b: outB,
          block: block.id,
        });
        const existing = countMap.get(block.id);
        if (existing) existing.count++;
        else
          countMap.set(block.id, {
            id: block.id,
            name: block.name,
            rgb: [block.rgb[0], block.rgb[1], block.rgb[2]],
            count: 1,
          });
      }
    }
    if (y % 4 === 0) {
      onProgress?.(0.88 + 0.12 * (y / height));
      await yieldToMain();
    }
  }

  const counts = [...countMap.values()].sort((a, b) => b.count - a.count);
  onProgress?.(1);
  return { width, height, depth, scale: scaleV, origin, zUp, voxels, counts };
}
