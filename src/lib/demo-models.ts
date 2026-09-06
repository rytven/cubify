import {
  Color,
  DoubleSide,
  ExtrudeGeometry,
  Float32BufferAttribute,
  Group,
  IcosahedronGeometry,
  LatheGeometry,
  Mesh,
  MeshStandardMaterial,
  Shape,
  TorusKnotGeometry,
  Vector2,
  type BufferGeometry,
} from "three";
import { DEMOS, type DemoId } from "@/lib/demo-list";
import { centerGroup, prepareMeshes } from "@/lib/load-model";
import type { PreparedMesh } from "@/lib/voxelize";

export { DEMOS, type DemoId };

function colorize(geo: BufferGeometry, fn: (x: number, y: number, z: number) => Color) {
  const pos = geo.getAttribute("position");
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const c = fn(pos.getX(i), pos.getY(i), pos.getZ(i));
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute("color", new Float32BufferAttribute(colors, 3));
}

function meshOf(geo: BufferGeometry) {
  return new Mesh(
    geo,
    new MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.48,
      metalness: 0.08,
      side: DoubleSide,
    }),
  );
}

function knot() {
  const geo = new TorusKnotGeometry(1, 0.32, 220, 32, 2, 3);
  const c = new Color();
  colorize(geo, (x, y, z) => {
    const h = (Math.atan2(z, x) / (Math.PI * 2) + 1) % 1;
    return c.setHSL(h, 0.62, 0.52 + y * 0.08);
  });
  return meshOf(geo);
}

function heart() {
  const shape = new Shape();
  shape.moveTo(0, 0.55);
  shape.bezierCurveTo(0.15, 0.95, 0.7, 0.85, 0.7, 0.35);
  shape.bezierCurveTo(0.7, 0.05, 0.2, -0.25, 0, -0.7);
  shape.bezierCurveTo(-0.2, -0.25, -0.7, 0.05, -0.7, 0.35);
  shape.bezierCurveTo(-0.7, 0.85, -0.15, 0.95, 0, 0.55);
  const geo = new ExtrudeGeometry(shape, {
    depth: 0.45,
    bevelEnabled: true,
    bevelThickness: 0.08,
    bevelSize: 0.06,
    bevelSegments: 4,
    curveSegments: 28,
  });
  geo.center();
  const c = new Color();
  colorize(geo, (_x, y) => c.setHSL(0.98, 0.72, 0.42 + y * 0.12));
  return meshOf(geo);
}

function vase() {
  const pts: Vector2[] = [];
  for (let i = 0; i <= 32; i++) {
    const t = i / 32;
    const y = t * 2 - 1;
    const r =
      0.22 +
      0.28 * Math.sin(t * Math.PI) +
      0.08 * Math.sin(t * Math.PI * 2) +
      (t > 0.82 ? (t - 0.82) * 1.4 : 0);
    pts.push(new Vector2(r, y));
  }
  const geo = new LatheGeometry(pts, 48);
  const c = new Color();
  colorize(geo, (_x, y) => c.setHSL(0.07, 0.48, 0.38 + y * 0.1));
  return meshOf(geo);
}

function crystal() {
  const geo = new IcosahedronGeometry(1, 0);
  const c = new Color();
  colorize(geo, (x, y, z) => {
    const n = 0.5 + 0.5 * (y * 0.5 + x * 0.2 + z * 0.2);
    return c.setHSL(0.48 + n * 0.08, 0.35, 0.42 + n * 0.18);
  });
  return meshOf(geo);
}

function star() {
  const shape = new Shape();
  const spikes = 5;
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 === 0 ? 0.95 : 0.4;
    const a = (i / (spikes * 2)) * Math.PI * 2 - Math.PI / 2;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  const geo = new ExtrudeGeometry(shape, {
    depth: 0.28,
    bevelEnabled: true,
    bevelThickness: 0.05,
    bevelSize: 0.04,
    bevelSegments: 2,
  });
  geo.center();
  const c = new Color();
  colorize(geo, (_x, y) => c.setHSL(0.12, 0.7, 0.5 + y * 0.08));
  return meshOf(geo);
}

const BUILDERS: Record<DemoId, () => Mesh> = { knot, heart, vase, crystal, star };

export function buildDemo(id: DemoId): { group: Group; meshes: PreparedMesh[]; name: string } {
  const group = new Group();
  group.add(BUILDERS[id]());
  centerGroup(group);
  const label = DEMOS.find((d) => d.id === id)?.label ?? id;
  return { group, meshes: prepareMeshes(group), name: `${label}.demo` };
}
