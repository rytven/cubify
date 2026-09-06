import { gzip } from "pako";
import { BedrockNbt, NbtWriter, writeVarInt } from "@/lib/nbt";
import type { VoxelResult } from "@/lib/voxelize";

export interface ReadyFile {
  url: string;
  filename: string;
  blob: Blob;
  href?: string;
}

let liveUrl: string | null = null;

function armDownload(blob: Blob, filename: string): ReadyFile {
  if (liveUrl) URL.revokeObjectURL(liveUrl);
  const url = URL.createObjectURL(blob);
  liveUrl = url;
  return { url, filename, blob };
}

type SavePicker = (opts?: {
  suggestedName?: string;
  types?: Array<{ description?: string; accept: Record<string, string[]> }>;
}) => Promise<{
  createWritable: () => Promise<{
    write: (data: Blob) => Promise<void>;
    close: () => Promise<void>;
  }>;
}>;

export async function copyText(
  text: string,
  input?: HTMLInputElement | HTMLTextAreaElement | null,
): Promise<boolean> {
  if (input) {
    input.focus();
    input.select();
    input.setSelectionRange(0, text.length);
  }
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Brave and embedded previews often block the clipboard API.
  }
  try {
    if (document.execCommand("copy")) return true;
  } catch {
    // fall through to a hidden textarea
  }
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  ta.style.position = "fixed";
  ta.style.top = "0";
  ta.style.left = "0";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  ta.remove();
  return ok;
}

export async function saveReadyFile(
  file: ReadyFile,
): Promise<"saved" | "cancelled" | "blocked"> {
  const picker = (window as unknown as { showSaveFilePicker?: SavePicker }).showSaveFilePicker;
  if (typeof picker === "function") {
    try {
      const handle = await picker({
        suggestedName: file.filename,
      });
      const writable = await handle.createWritable();
      await writable.write(file.blob);
      await writable.close();
      return "saved";
    } catch (err) {
      const name = err instanceof DOMException ? err.name : "";
      if (name === "AbortError") return "cancelled";
    }
  }

  const native = new File([file.blob], file.filename, {
    type: file.blob.type || "application/octet-stream",
  });
  const nav = navigator as Navigator & {
    canShare?: (data: { files: File[] }) => boolean;
    share?: (data: { files: File[]; title: string }) => Promise<void>;
  };
  if (nav.canShare?.({ files: [native] })) {
    try {
      await nav.share({ files: [native], title: file.filename });
      return "saved";
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return "cancelled";
    }
  }

  if (file.href) {
    const popup = window.open(file.href, "_blank", "noopener,noreferrer");
    if (popup) return "saved";
  }

  const a = document.createElement("a");
  a.href = file.href ?? file.url;
  a.download = file.filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  return "blocked";
}

export async function publishExport(file: ReadyFile): Promise<string> {
  const res = await fetch("/api/export", {
    method: "POST",
    headers: {
      "content-type": "application/octet-stream",
      "x-filename": file.filename,
    },
    body: file.blob,
  });
  if (!res.ok) throw new Error("Could not prepare a download link");
  const data = (await res.json()) as { url: string };
  return new URL(data.url, window.location.origin).href;
}

export function slugName(name: string): string {
  return name.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9_-]+/g, "-").toLowerCase() || "cubify";
}

export function exportSchematic(result: VoxelResult, name: string): ReadyFile {
  const { width, height, depth, voxels } = result;
  const palette = new Map<string, number>();
  palette.set("minecraft:air", 0);
  for (const v of voxels) {
    const id = `minecraft:${v.block}`;
    if (!palette.has(id)) palette.set(id, palette.size);
  }
  const indexOf = new Int32Array(width * height * depth);
  for (const v of voxels) {
    const i = v.x + v.z * width + v.y * width * depth;
    indexOf[i] = palette.get(`minecraft:${v.block}`)!;
  }
  const packed: number[] = [];
  for (let i = 0; i < indexOf.length; i++) writeVarInt(indexOf[i]!, packed);

  const w = new NbtWriter();
  w.compound("Schematic", () => {
    w.int("Version", 2);
    w.int("DataVersion", 3953);
    w.short("Width", width);
    w.short("Height", height);
    w.short("Length", depth);
    w.intArray("Offset", [0, 0, 0]);
    w.int("PaletteMax", palette.size);
    w.compound("Palette", () => {
      for (const [id, i] of palette) w.int(id, i);
    });
    w.byteArray("BlockData", Uint8Array.from(packed));
    w.emptyCompoundList("BlockEntities");
    w.compound("Metadata", () => {
      w.string("Name", name);
      w.string("Author", "Cubify");
    });
  });
  const gz = gzip(w.bytes);
  return armDownload(
    new Blob([gz], { type: "application/octet-stream" }),
    `${slugName(name)}.schem`,
  );
}

export function exportMcfunction(result: VoxelResult, name: string): ReadyFile {
  const lines = [
    `# Cubify — ${name}`,
    `# ${result.width}x${result.height}x${result.depth}  ${result.voxels.length} blocks`,
    `# Paste with: /function namespace:${slugName(name)}`,
  ];
  for (const v of result.voxels) {
    lines.push(`setblock ~${v.x} ~${v.y} ~${v.z} minecraft:${v.block}`);
  }
  const blob = new Blob([lines.join("\n") + "\n"], { type: "text/plain" });
  return armDownload(blob, `${slugName(name)}.mcfunction`);
}

export function exportJson(result: VoxelResult, name: string): ReadyFile {
  const body = {
    name,
    width: result.width,
    height: result.height,
    depth: result.depth,
    blocks: result.voxels.map((v) => ({
      x: v.x,
      y: v.y,
      z: v.z,
      id: `minecraft:${v.block}`,
    })),
    palette: result.counts.map((c) => ({
      id: `minecraft:${c.id}`,
      name: c.name,
      count: c.count,
    })),
  };
  const blob = new Blob([JSON.stringify(body)], { type: "application/json" });
  return armDownload(blob, `${slugName(name)}.json`);
}

/** Bedrock Edition structure block file (little-endian NBT, uncompressed). */
const BEDROCK_BLOCK_VERSION = 18168865;

export function exportMcstructure(result: VoxelResult, name: string): ReadyFile {
  const { width, height, depth, voxels } = result;
  const palette: string[] = [];
  const indexOf = new Map<string, number>();
  for (const v of voxels) {
    const id = `minecraft:${v.block}`;
    if (!indexOf.has(id)) {
      indexOf.set(id, palette.length);
      palette.push(id);
    }
  }
  const count = width * height * depth;
  const layer0 = new Int32Array(count);
  layer0.fill(-1);
  const yStride = depth;
  const xStride = height * depth;
  for (const v of voxels) {
    layer0[v.z + v.y * yStride + v.x * xStride] = indexOf.get(`minecraft:${v.block}`)!;
  }
  const layer1 = new Int32Array(count);
  layer1.fill(-1);

  const nbt = new BedrockNbt();
  nbt.root(() => {
    nbt.int("format_version", 1);
    nbt.intList("size", [width, height, depth]);
    nbt.compound("structure", () => {
      nbt.listOfIntLists("block_indices", [layer0, layer1]);
      nbt.emptyCompoundList("entities");
      nbt.compound("palette", () => {
        nbt.compound("default", () => {
          nbt.compoundList("block_palette", palette.length, () => {
            for (const id of palette) {
              nbt.unnamedCompound(() => {
                nbt.string("name", id);
                nbt.emptyCompound("states");
                nbt.int("version", BEDROCK_BLOCK_VERSION);
              });
            }
          });
          nbt.emptyCompound("block_position_data");
        });
      });
    });
    nbt.intList("structure_world_origin", [0, 0, 0]);
  });

  const raw = nbt.bytes;
  const copy = new Uint8Array(raw.byteLength);
  copy.set(raw);
  return armDownload(
    new Blob([copy], { type: "application/octet-stream" }),
    `${slugName(name)}.mcstructure`,
  );
}

export function exportVox(result: VoxelResult, name: string): ReadyFile {
  const paletteColors: Array<[number, number, number]> = [];
  const colorIndex = new Map<string, number>();
  for (const v of result.voxels) {
    const key = `${v.r},${v.g},${v.b}`;
    if (!colorIndex.has(key)) {
      if (paletteColors.length >= 255) {
        colorIndex.set(key, 1);
      } else {
        paletteColors.push([v.r, v.g, v.b]);
        colorIndex.set(key, paletteColors.length);
      }
    }
  }
  const voxels = result.voxels.map((v) => ({
    x: v.x,
    y: v.z,
    z: v.y,
    i: colorIndex.get(`${v.r},${v.g},${v.b}`) ?? 1,
  }));

  const sizeContent = 12;
  const xyziContent = 4 + voxels.length * 4;
  const rgbaContent = 1024;
  const children =
    12 + sizeContent + 12 + xyziContent + (paletteColors.length ? 12 + rgbaContent : 0);

  const buf = new ArrayBuffer(8 + 12 + children);
  const view = new DataView(buf);
  const u8 = new Uint8Array(buf);
  const enc = new TextEncoder();
  let o = 0;
  const four = (s: string) => {
    u8.set(enc.encode(s), o);
    o += 4;
  };
  const i32 = (n: number) => {
    view.setInt32(o, n, true);
    o += 4;
  };
  four("VOX ");
  i32(150);
  four("MAIN");
  i32(0);
  i32(children);
  four("SIZE");
  i32(sizeContent);
  i32(0);
  i32(result.width);
  i32(result.depth);
  i32(result.height);
  four("XYZI");
  i32(xyziContent);
  i32(0);
  i32(voxels.length);
  for (const v of voxels) {
    u8[o++] = v.x & 255;
    u8[o++] = v.y & 255;
    u8[o++] = v.z & 255;
    u8[o++] = v.i & 255;
  }
  if (paletteColors.length) {
    four("RGBA");
    i32(rgbaContent);
    i32(0);
    for (let i = 0; i < 256; i++) {
      const c = paletteColors[i] ?? [0, 0, 0];
      u8[o++] = c[0];
      u8[o++] = c[1];
      u8[o++] = c[2];
      u8[o++] = 255;
    }
  }
  return armDownload(
    new Blob([buf], { type: "application/octet-stream" }),
    `${slugName(name)}.vox`,
  );
}
