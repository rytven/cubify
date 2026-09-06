import { deltaE, luma8, rgbToLab, type RGB } from "@/lib/color";

export type PaletteGroup =
  | "wool"
  | "concrete"
  | "terracotta"
  | "powder"
  | "wood"
  | "stone"
  | "nature"
  | "mineral";

export type PalettePack = "all" | "wool" | "concrete" | "terracotta" | "natural";

export interface McBlock {
  id: string;
  name: string;
  rgb: RGB;
  group: PaletteGroup;
  lab: RGB;
}

const RAW: Array<[string, string, RGB, PaletteGroup]> = [
  ["white_wool", "White Wool", [234, 236, 236], "wool"],
  ["orange_wool", "Orange Wool", [241, 118, 19], "wool"],
  ["magenta_wool", "Magenta Wool", [189, 68, 179], "wool"],
  ["light_blue_wool", "Light Blue Wool", [58, 175, 217], "wool"],
  ["yellow_wool", "Yellow Wool", [249, 198, 39], "wool"],
  ["lime_wool", "Lime Wool", [112, 185, 25], "wool"],
  ["pink_wool", "Pink Wool", [237, 141, 172], "wool"],
  ["gray_wool", "Gray Wool", [62, 68, 71], "wool"],
  ["light_gray_wool", "Light Gray Wool", [142, 142, 134], "wool"],
  ["cyan_wool", "Cyan Wool", [21, 137, 145], "wool"],
  ["purple_wool", "Purple Wool", [121, 42, 172], "wool"],
  ["blue_wool", "Blue Wool", [53, 57, 157], "wool"],
  ["brown_wool", "Brown Wool", [114, 71, 40], "wool"],
  ["green_wool", "Green Wool", [84, 109, 27], "wool"],
  ["red_wool", "Red Wool", [160, 39, 34], "wool"],
  ["black_wool", "Black Wool", [20, 21, 25], "wool"],

  ["white_concrete", "White Concrete", [207, 213, 214], "concrete"],
  ["orange_concrete", "Orange Concrete", [224, 97, 0], "concrete"],
  ["magenta_concrete", "Magenta Concrete", [169, 48, 159], "concrete"],
  ["light_blue_concrete", "Light Blue Concrete", [35, 137, 198], "concrete"],
  ["yellow_concrete", "Yellow Concrete", [241, 175, 21], "concrete"],
  ["lime_concrete", "Lime Concrete", [94, 169, 24], "concrete"],
  ["pink_concrete", "Pink Concrete", [214, 101, 143], "concrete"],
  ["gray_concrete", "Gray Concrete", [54, 57, 61], "concrete"],
  ["light_gray_concrete", "Light Gray Concrete", [125, 125, 115], "concrete"],
  ["cyan_concrete", "Cyan Concrete", [21, 119, 136], "concrete"],
  ["purple_concrete", "Purple Concrete", [100, 31, 156], "concrete"],
  ["blue_concrete", "Blue Concrete", [45, 47, 143], "concrete"],
  ["brown_concrete", "Brown Concrete", [96, 59, 31], "concrete"],
  ["green_concrete", "Green Concrete", [73, 91, 36], "concrete"],
  ["red_concrete", "Red Concrete", [142, 32, 32], "concrete"],
  ["black_concrete", "Black Concrete", [8, 10, 15], "concrete"],

  ["white_concrete_powder", "White Concrete Powder", [226, 227, 227], "powder"],
  ["orange_concrete_powder", "Orange Concrete Powder", [227, 131, 31], "powder"],
  ["magenta_concrete_powder", "Magenta Concrete Powder", [192, 83, 184], "powder"],
  ["light_blue_concrete_powder", "Light Blue Concrete Powder", [74, 180, 213], "powder"],
  ["yellow_concrete_powder", "Yellow Concrete Powder", [233, 199, 54], "powder"],
  ["lime_concrete_powder", "Lime Concrete Powder", [125, 189, 41], "powder"],
  ["pink_concrete_powder", "Pink Concrete Powder", [229, 153, 181], "powder"],
  ["gray_concrete_powder", "Gray Concrete Powder", [77, 80, 82], "powder"],
  ["light_gray_concrete_powder", "Light Gray Concrete Powder", [155, 155, 148], "powder"],
  ["cyan_concrete_powder", "Cyan Concrete Powder", [36, 147, 157], "powder"],
  ["purple_concrete_powder", "Purple Concrete Powder", [131, 55, 177], "powder"],
  ["blue_concrete_powder", "Blue Concrete Powder", [70, 73, 166], "powder"],
  ["brown_concrete_powder", "Brown Concrete Powder", [125, 84, 53], "powder"],
  ["green_concrete_powder", "Green Concrete Powder", [97, 119, 44], "powder"],
  ["red_concrete_powder", "Red Concrete Powder", [168, 54, 50], "powder"],
  ["black_concrete_powder", "Black Concrete Powder", [25, 26, 31], "powder"],

  ["terracotta", "Terracotta", [152, 94, 67], "terracotta"],
  ["white_terracotta", "White Terracotta", [210, 178, 161], "terracotta"],
  ["orange_terracotta", "Orange Terracotta", [162, 83, 38], "terracotta"],
  ["magenta_terracotta", "Magenta Terracotta", [150, 88, 109], "terracotta"],
  ["light_blue_terracotta", "Light Blue Terracotta", [116, 110, 138], "terracotta"],
  ["yellow_terracotta", "Yellow Terracotta", [186, 133, 35], "terracotta"],
  ["lime_terracotta", "Lime Terracotta", [103, 117, 52], "terracotta"],
  ["pink_terracotta", "Pink Terracotta", [162, 78, 78], "terracotta"],
  ["gray_terracotta", "Gray Terracotta", [57, 42, 36], "terracotta"],
  ["light_gray_terracotta", "Light Gray Terracotta", [135, 107, 98], "terracotta"],
  ["cyan_terracotta", "Cyan Terracotta", [86, 91, 91], "terracotta"],
  ["purple_terracotta", "Purple Terracotta", [118, 70, 86], "terracotta"],
  ["blue_terracotta", "Blue Terracotta", [74, 59, 91], "terracotta"],
  ["brown_terracotta", "Brown Terracotta", [77, 51, 36], "terracotta"],
  ["green_terracotta", "Green Terracotta", [76, 83, 42], "terracotta"],
  ["red_terracotta", "Red Terracotta", [143, 61, 46], "terracotta"],
  ["black_terracotta", "Black Terracotta", [37, 22, 16], "terracotta"],

  ["oak_planks", "Oak Planks", [162, 130, 78], "wood"],
  ["spruce_planks", "Spruce Planks", [114, 84, 48], "wood"],
  ["birch_planks", "Birch Planks", [192, 175, 121], "wood"],
  ["jungle_planks", "Jungle Planks", [160, 115, 80], "wood"],
  ["acacia_planks", "Acacia Planks", [168, 90, 50], "wood"],
  ["dark_oak_planks", "Dark Oak Planks", [66, 43, 20], "wood"],
  ["mangrove_planks", "Mangrove Planks", [117, 54, 48], "wood"],
  ["cherry_planks", "Cherry Planks", [226, 178, 172], "wood"],
  ["bamboo_planks", "Bamboo Planks", [193, 173, 80], "wood"],
  ["crimson_planks", "Crimson Planks", [101, 48, 70], "wood"],
  ["warped_planks", "Warped Planks", [43, 104, 99], "wood"],
  ["oak_log", "Oak Log", [109, 85, 50], "wood"],
  ["stripped_oak_log", "Stripped Oak Log", [177, 144, 86], "wood"],
  ["spruce_log", "Spruce Log", [58, 37, 16], "wood"],
  ["birch_log", "Birch Log", [216, 215, 210], "wood"],
  ["jungle_log", "Jungle Log", [85, 67, 25], "wood"],
  ["acacia_log", "Acacia Log", [103, 96, 86], "wood"],
  ["dark_oak_log", "Dark Oak Log", [60, 46, 26], "wood"],
  ["mangrove_log", "Mangrove Log", [83, 66, 53], "wood"],
  ["cherry_log", "Cherry Log", [54, 33, 44], "wood"],
  ["bamboo_block", "Bamboo Block", [127, 143, 57], "wood"],
  ["crimson_stem", "Crimson Stem", [92, 48, 68], "wood"],
  ["warped_stem", "Warped Stem", [58, 58, 77], "wood"],

  ["stone", "Stone", [125, 125, 125], "stone"],
  ["smooth_stone", "Smooth Stone", [158, 158, 158], "stone"],
  ["cobblestone", "Cobblestone", [127, 127, 127], "stone"],
  ["mossy_cobblestone", "Mossy Cobblestone", [110, 118, 94], "stone"],
  ["stone_bricks", "Stone Bricks", [122, 121, 122], "stone"],
  ["mossy_stone_bricks", "Mossy Stone Bricks", [115, 121, 105], "stone"],
  ["deepslate", "Deepslate", [80, 80, 82], "stone"],
  ["cobbled_deepslate", "Cobbled Deepslate", [77, 77, 80], "stone"],
  ["polished_deepslate", "Polished Deepslate", [72, 72, 73], "stone"],
  ["deepslate_bricks", "Deepslate Bricks", [70, 70, 71], "stone"],
  ["deepslate_tiles", "Deepslate Tiles", [54, 54, 55], "stone"],
  ["tuff", "Tuff", [108, 109, 103], "stone"],
  ["calcite", "Calcite", [223, 224, 220], "stone"],
  ["dripstone_block", "Dripstone Block", [134, 107, 92], "stone"],
  ["andesite", "Andesite", [136, 136, 136], "stone"],
  ["polished_andesite", "Polished Andesite", [132, 134, 133], "stone"],
  ["diorite", "Diorite", [188, 188, 188], "stone"],
  ["polished_diorite", "Polished Diorite", [192, 192, 192], "stone"],
  ["granite", "Granite", [149, 103, 86], "stone"],
  ["polished_granite", "Polished Granite", [154, 106, 89], "stone"],
  ["basalt", "Basalt", [73, 72, 77], "stone"],
  ["smooth_basalt", "Smooth Basalt", [72, 72, 78], "stone"],
  ["blackstone", "Blackstone", [42, 36, 41], "stone"],
  ["polished_blackstone", "Polished Blackstone", [53, 48, 56], "stone"],
  ["obsidian", "Obsidian", [15, 10, 24], "stone"],
  ["crying_obsidian", "Crying Obsidian", [32, 10, 60], "stone"],
  ["netherrack", "Netherrack", [97, 38, 38], "stone"],
  ["nether_bricks", "Nether Bricks", [44, 21, 26], "stone"],
  ["red_nether_bricks", "Red Nether Bricks", [69, 7, 9], "stone"],
  ["end_stone", "End Stone", [219, 222, 158], "stone"],
  ["end_stone_bricks", "End Stone Bricks", [218, 224, 162], "stone"],
  ["purpur_block", "Purpur Block", [169, 125, 169], "stone"],
  ["prismarine", "Prismarine", [99, 156, 151], "stone"],
  ["prismarine_bricks", "Prismarine Bricks", [99, 171, 158], "stone"],
  ["dark_prismarine", "Dark Prismarine", [51, 91, 75], "stone"],
  ["quartz_block", "Quartz Block", [235, 229, 222], "stone"],
  ["smooth_quartz", "Smooth Quartz", [237, 230, 223], "stone"],
  ["sandstone", "Sandstone", [216, 203, 155], "stone"],
  ["smooth_sandstone", "Smooth Sandstone", [224, 214, 170], "stone"],
  ["red_sandstone", "Red Sandstone", [181, 97, 31], "stone"],
  ["bricks", "Bricks", [150, 97, 83], "stone"],
  ["mud_bricks", "Mud Bricks", [137, 103, 78], "stone"],
  ["packed_mud", "Packed Mud", [142, 106, 79], "stone"],

  ["dirt", "Dirt", [134, 96, 67], "nature"],
  ["coarse_dirt", "Coarse Dirt", [119, 85, 59], "nature"],
  ["podzol", "Podzol", [122, 87, 57], "nature"],
  ["sand", "Sand", [219, 207, 163], "nature"],
  ["red_sand", "Red Sand", [190, 102, 33], "nature"],
  ["gravel", "Gravel", [131, 127, 126], "nature"],
  ["clay", "Clay", [160, 166, 179], "nature"],
  ["snow_block", "Snow Block", [249, 254, 254], "nature"],
  ["ice", "Ice", [145, 183, 254], "nature"],
  ["packed_ice", "Packed Ice", [141, 180, 250], "nature"],
  ["blue_ice", "Blue Ice", [116, 167, 253], "nature"],
  ["moss_block", "Moss Block", [89, 109, 45], "nature"],
  ["pale_moss_block", "Pale Moss Block", [108, 115, 96], "nature"],
  ["hay_block", "Hay Block", [166, 136, 38], "nature"],
  ["honeycomb_block", "Honeycomb Block", [229, 148, 29], "nature"],
  ["honey_block", "Honey Block", [251, 185, 53], "nature"],
  ["slime_block", "Slime Block", [111, 192, 89], "nature"],
  ["dried_kelp_block", "Dried Kelp Block", [38, 48, 29], "nature"],
  ["sponge", "Sponge", [195, 192, 74], "nature"],
  ["wet_sponge", "Wet Sponge", [171, 167, 70], "nature"],
  ["melon", "Melon", [111, 144, 30], "nature"],
  ["pumpkin", "Pumpkin", [197, 118, 24], "nature"],
  ["cactus", "Cactus", [85, 127, 32], "nature"],
  ["oak_leaves", "Oak Leaves", [60, 125, 36], "nature"],
  ["spruce_leaves", "Spruce Leaves", [47, 81, 47], "nature"],
  ["birch_leaves", "Birch Leaves", [81, 108, 52], "nature"],
  ["azalea_leaves", "Azalea Leaves", [90, 115, 44], "nature"],
  ["nether_wart_block", "Nether Wart Block", [114, 3, 2], "nature"],
  ["warped_wart_block", "Warped Wart Block", [22, 119, 121], "nature"],
  ["shroomlight", "Shroomlight", [240, 146, 70], "nature"],
  ["brown_mushroom_block", "Brown Mushroom Block", [149, 111, 81], "nature"],
  ["red_mushroom_block", "Red Mushroom Block", [200, 46, 45], "nature"],
  ["mushroom_stem", "Mushroom Stem", [203, 196, 185], "nature"],
  ["sculk", "Sculk", [13, 43, 48], "nature"],
  ["soul_sand", "Soul Sand", [81, 62, 50], "nature"],
  ["soul_soil", "Soul Soil", [75, 57, 46], "nature"],
  ["magma_block", "Magma Block", [141, 61, 31], "nature"],
  ["glowstone", "Glowstone", [171, 131, 73], "nature"],
  ["sea_lantern", "Sea Lantern", [172, 199, 190], "nature"],

  ["coal_block", "Coal Block", [16, 15, 20], "mineral"],
  ["iron_block", "Iron Block", [220, 220, 220], "mineral"],
  ["gold_block", "Gold Block", [246, 208, 61], "mineral"],
  ["diamond_block", "Diamond Block", [98, 237, 228], "mineral"],
  ["emerald_block", "Emerald Block", [42, 203, 87], "mineral"],
  ["lapis_block", "Lapis Block", [30, 66, 139], "mineral"],
  ["redstone_block", "Redstone Block", [181, 24, 5], "mineral"],
  ["copper_block", "Copper Block", [192, 107, 79], "mineral"],
  ["exposed_copper", "Exposed Copper", [161, 125, 103], "mineral"],
  ["weathered_copper", "Weathered Copper", [108, 153, 110], "mineral"],
  ["oxidized_copper", "Oxidized Copper", [82, 162, 132], "mineral"],
  ["raw_iron_block", "Raw Iron Block", [166, 135, 107], "mineral"],
  ["raw_gold_block", "Raw Gold Block", [221, 169, 46], "mineral"],
  ["raw_copper_block", "Raw Copper Block", [154, 105, 79], "mineral"],
  ["netherite_block", "Netherite Block", [66, 61, 63], "mineral"],
  ["amethyst_block", "Amethyst Block", [133, 97, 191], "mineral"],
  ["bone_block", "Bone Block", [229, 225, 207], "mineral"],
  ["ancient_debris", "Ancient Debris", [95, 63, 55], "mineral"],
  ["ochre_froglight", "Ochre Froglight", [251, 245, 191], "mineral"],
  ["verdant_froglight", "Verdant Froglight", [216, 240, 192], "mineral"],
  ["pearlescent_froglight", "Pearlescent Froglight", [235, 224, 228], "mineral"],
];

export const BLOCKS: McBlock[] = RAW.map(([id, name, rgb, group]) => ({
  id,
  name,
  rgb,
  group,
  lab: rgbToLab(rgb[0], rgb[1], rgb[2]),
}));

export const BLOCK_BY_ID = new Map(BLOCKS.map((b) => [b.id, b]));

const PACK_GROUPS: Record<PalettePack, ReadonlySet<PaletteGroup> | null> = {
  all: null,
  wool: new Set(["wool"]),
  concrete: new Set(["concrete", "powder"]),
  terracotta: new Set(["terracotta"]),
  natural: new Set(["wood", "stone", "nature", "mineral"]),
};

/** Coal, obsidian, black wool, sculk — photogrammetry shadows snap here. */
export const VOID_LUMA = 28;

const UNSTABLE_IDS = new Set([
  "sand",
  "red_sand",
  "gravel",
  "oak_leaves",
  "spruce_leaves",
  "birch_leaves",
  "azalea_leaves",
  "cactus",
]);

/** Gravity blocks, decaying leaves, and cactus — they collapse or vanish in-game. */
export function isUnstableBlock(block: McBlock): boolean {
  return block.group === "powder" || UNSTABLE_IDS.has(block.id);
}

export function blocksForPack(pack: PalettePack): McBlock[] {
  const groups = PACK_GROUPS[pack];
  const list = groups ? BLOCKS.filter((b) => groups.has(b.group)) : BLOCKS;
  return list.filter((b) => !isUnstableBlock(b));
}

export function nearestBlock(
  r: number,
  g: number,
  b: number,
  pack: PalettePack,
  cache?: Map<number, McBlock>,
  skipDark = false,
): McBlock {
  const key = ((r & 255) << 16) | ((g & 255) << 8) | (b & 255);
  if (cache) {
    const hit = cache.get(key);
    if (hit) return hit;
  }
  const lab = rgbToLab(r, g, b);
  const list = blocksForPack(pack);
  let best = list[0]!;
  let bestD = Infinity;
  let any = false;
  for (const block of list) {
    if (skipDark && luma8(block.rgb[0], block.rgb[1], block.rgb[2]) < VOID_LUMA) continue;
    const d = deltaE(lab, block.lab);
    if (d < bestD) {
      bestD = d;
      best = block;
      any = true;
    }
  }
  if (!any) {
    for (const block of list) {
      const d = deltaE(lab, block.lab);
      if (d < bestD) {
        bestD = d;
        best = block;
      }
    }
  }
  cache?.set(key, best);
  return best;
}

export const PACK_LABELS: Record<PalettePack, string> = {
  all: "All blocks",
  wool: "Wool",
  concrete: "Concrete",
  terracotta: "Terracotta",
  natural: "Natural",
};
