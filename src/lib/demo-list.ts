export type DemoId = "knot" | "heart" | "vase" | "crystal" | "star";

export const DEMOS: { id: DemoId; label: string; blurb: string }[] = [
  { id: "knot", label: "Knot", blurb: "Twisted torus" },
  { id: "heart", label: "Heart", blurb: "Classic heart" },
  { id: "vase", label: "Vase", blurb: "Lathed clay" },
  { id: "crystal", label: "Crystal", blurb: "Faceted gem" },
  { id: "star", label: "Star", blurb: "Extruded star" },
];
