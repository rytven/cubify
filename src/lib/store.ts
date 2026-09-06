import { create } from "zustand";
import type { PalettePack } from "@/lib/minecraft-palette";
import type { ReadyFile } from "@/lib/export-schematic";
import type { PreparedMesh, VoxelResult } from "@/lib/voxelize";

export type ViewMode = "voxels" | "original" | "both";
export type ColorMode = "minecraft" | "original";
export type FillMode = "solid" | "hollow";

export interface StudioState {
  name: string;
  meshes: PreparedMesh[] | null;
  sourceRev: number;
  result: VoxelResult | null;
  lastFile: ReadyFile | null;
  resolution: number;
  fill: FillMode;
  pack: PalettePack;
  dither: boolean;
  zUp: boolean;
  liftShadows: boolean;
  colorMode: ColorMode;
  viewMode: ViewMode;
  status: "ready" | "loading" | "voxelizing" | "error";
  progress: number;
  error: string | null;
  dragging: boolean;
  setDragging: (v: boolean) => void;
  setViewMode: (v: ViewMode) => void;
  setResolution: (v: number) => void;
  setFill: (v: FillMode) => void;
  setPack: (v: PalettePack) => void;
  setDither: (v: boolean) => void;
  setZUp: (v: boolean) => void;
  setLiftShadows: (v: boolean) => void;
  setColorMode: (v: ColorMode) => void;
  setSource: (name: string, meshes: PreparedMesh[]) => void;
  setResult: (result: VoxelResult | null) => void;
  setLastFile: (file: ReadyFile | null) => void;
  setStatus: (status: StudioState["status"], error?: string | null) => void;
  setProgress: (v: number) => void;
}

export const useStudio = create<StudioState>((set) => ({
  name: "Knot.demo",
  meshes: null,
  sourceRev: 0,
  result: null,
  lastFile: null,
  resolution: 40,
  fill: "hollow",
  pack: "all",
  dither: true,
  zUp: false,
  liftShadows: true,
  colorMode: "original",
  viewMode: "voxels",
  status: "ready",
  progress: 0,
  error: null,
  dragging: false,
  setDragging: (dragging) => set({ dragging }),
  setViewMode: (viewMode) => set({ viewMode }),
  setResolution: (resolution) => set({ resolution }),
  setFill: (fill) => set({ fill }),
  setPack: (pack) => set({ pack }),
  setDither: (dither) => set({ dither }),
  setZUp: (zUp) => set({ zUp }),
  setLiftShadows: (liftShadows) => set({ liftShadows }),
  setColorMode: (colorMode) => set({ colorMode }),
  setSource: (name, meshes) =>
    set((s) => ({
      name,
      meshes,
      result: null,
      lastFile: null,
      error: null,
      status: "loading",
      sourceRev: s.sourceRev + 1,
    })),
  setResult: (result) => set({ result, status: "ready", progress: 1, error: null }),
  setLastFile: (lastFile) => set({ lastFile }),
  setStatus: (status, error = null) => set({ status, error: error ?? null }),
  setProgress: (progress) => set({ progress }),
}));
