# Cubify

Turn a 3D model into Minecraft blocks. Upload a GLB, GLTF, OBJ, or STL, voxelize it with color matching to the Minecraft palette, then export a schematic you can paste in-game.

Built for photogrammetry scans as well as game-ready meshes.

## Features

- Client-side voxelization (no account required)
- Resolutions up to 256 along the longest axis
- Hollow or solid fill
- Minecraft palette matching (CIE Lab) with optional texture-true preview colors
- 3D dithering to break banding
- Shadow lift for photogrammetry atlases
- Gravity blocks (sand, gravel, concrete powder), decaying leaves, and cactus are never used so the build stays put
- Exports:
  - **`.schem`** — WorldEdit / Java
  - **`.mcstructure`** — Bedrock structure blocks
  - **`.mcfunction`** — `/setblock` commands
  - **`.vox`** — MagicaVoxel
  - **`.json`** — generic block list

## Run locally

```bash
npm install
npm run dev
```

Then open the printed local URL. For a production build:

```bash
npm run build
npm run preview
```

Requires Node.js 22+.

## Usage

1. Drop a model (or pick a demo).
2. Set resolution — photogrammetry scans want 128–256.
3. Prefer **Hollow** for buildings.
4. Export the format you need.

### In Minecraft

- **Java:** WorldEdit `//schem load <name>` then `//paste`
- **Bedrock:** put the `.mcstructure` in a behavior pack `structures` folder, then `/structure load <name> ~ ~ ~`

## Stack

TanStack Start, React 19, Three.js / React Three Fiber, Tailwind v4, Zustand.

## License

Private source for the repository owner. Adjust as you like.
