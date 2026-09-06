const ACCEPT = new Set(["glb", "gltf", "obj", "stl"]);

export function extOf(name: string): string {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

export function isSupportedModel(name: string): boolean {
  return ACCEPT.has(extOf(name));
}
