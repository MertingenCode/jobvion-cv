export const freeTemplateIds = ["essential", "compact", "executive"] as const;

type Layout = "linear" | "left" | "right";
type Heading = "plain" | "line" | "bar" | "smallcaps" | "block";
type Header = "aligned" | "center" | "hero" | "wide" | "boxed";
type Type = "neutral" | "editorial" | "modern";

export type Template = {
  id: string;
  name: string;
  layout: Layout;
  heading: Heading;
  header: Header;
  typography: Type;
  accent: string;
  columns: 1 | 2;
  supports_photo: boolean;
  ats_safe: boolean;
  rtl_ready: boolean;
  languages: readonly string[];
  tier: "free" | "premium";
};

const palette = {
  ink: "#173247",
  forest: "#27564d",
  teal: "#155769",
  slate: "#38425a",
  aubergine: "#514068",
  terracotta: "#834638",
  marine: "#184d80",
  olive: "#4a562d",
  umber: "#685040",
} as const;

const languages = ["tr", "en", "de", "fr", "es", "it", "pt", "nl"] as const;
type Accent = keyof typeof palette;
type Blueprint = readonly [id: string, name: string, layout: Layout, heading: Heading, header: Header, typography: Type, accent: Accent, photo: boolean];

const blueprints = [
  ["essential", "Essential", "linear", "plain", "aligned", "neutral", "ink", false],
  ["compact", "Compact", "linear", "smallcaps", "aligned", "modern", "ink", false],
  ["executive", "Executive", "linear", "line", "center", "editorial", "ink", false],
  ["atlas", "Atlas", "left", "bar", "wide", "modern", "marine", true],
  ["archive", "Archive", "left", "line", "aligned", "editorial", "umber", false],
  ["anchor", "Anchor", "left", "block", "hero", "neutral", "forest", true],
  ["boreal", "Boreal", "right", "line", "wide", "neutral", "teal", true],
  ["brio", "Brio", "right", "bar", "center", "modern", "terracotta", true],
  ["baker", "Baker", "right", "smallcaps", "boxed", "editorial", "umber", false],
  ["clarity", "Clarity", "linear", "line", "wide", "modern", "slate", true],
  ["coda", "Coda", "linear", "block", "aligned", "editorial", "aubergine", false],
  ["canopy", "Canopy", "linear", "smallcaps", "center", "neutral", "olive", true],
  ["dune", "Dune", "left", "line", "boxed", "modern", "terracotta", true],
  ["delta", "Delta", "left", "smallcaps", "wide", "editorial", "marine", true],
  ["drift", "Drift", "left", "plain", "center", "neutral", "slate", false],
  ["ember", "Ember", "right", "block", "wide", "modern", "terracotta", true],
  ["elm", "Elm", "right", "plain", "aligned", "editorial", "forest", false],
  ["etch", "Etch", "right", "bar", "boxed", "neutral", "ink", true],
  ["folio", "Folio", "linear", "bar", "hero", "editorial", "marine", true],
  ["field", "Field", "linear", "plain", "boxed", "modern", "olive", false],
  ["fresco", "Fresco", "linear", "line", "aligned", "editorial", "terracotta", true],
  ["glen", "Glen", "left", "smallcaps", "center", "modern", "forest", false],
  ["grain", "Grain", "left", "block", "aligned", "editorial", "umber", true],
  ["grove", "Grove", "left", "bar", "hero", "neutral", "olive", true],
  ["harbor", "Harbor", "right", "line", "hero", "editorial", "marine", true],
  ["halo", "Halo", "right", "smallcaps", "center", "neutral", "aubergine", true],
  ["horizon", "Horizon", "right", "plain", "wide", "modern", "teal", false],
  ["isle", "Isle", "linear", "block", "center", "modern", "teal", true],
  ["index", "Index", "linear", "bar", "aligned", "neutral", "slate", false],
  ["inkstone", "Inkstone", "linear", "smallcaps", "hero", "editorial", "aubergine", true],
] as const satisfies readonly Blueprint[];

export const templates: readonly Template[] = blueprints.map(([id, name, layout, heading, header, typography, accent, photo]) => {
  const free = freeTemplateIds.some((freeId) => freeId === id);
  return {
    id, name, layout, heading, header, typography, accent: palette[accent],
    columns: layout === "linear" ? 1 : 2,
    supports_photo: photo, ats_safe: free, rtl_ready: false, languages,
    tier: free ? "free" : "premium",
  };
});

export function getTemplate(id: string) {
  return templates.find((template) => template.id === id);
}
