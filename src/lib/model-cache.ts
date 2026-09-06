import type { Group } from "three";

let source: Group | null = null;

export function setSourceGroup(group: Group | null) {
  source = group;
}

export function getSourceGroup(): Group | null {
  return source;
}
