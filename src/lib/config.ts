export type UiLang = "fr" | "nl" | "en";
export const UI_LANGS: UiLang[] = ["fr", "nl", "en"];
export const DEFAULT_UI_LANG: UiLang = "fr";

export const BRAND = {
  taupe: "#B8A99A",
  brown: "#8B7355",
  text: "#2D2D2D",
  background: "#F9F7F5",
};

export const DEFAULT_PROJECT = {
  slug: "dedecker",
  name: "DeDecker Keukens",
  brandLabel: "DeDecker",
  clientDomains: ["dedecker.be"],
};

export type MarketConfig = {
  code: string;
  country: string;
  language: string;
  isDefault: boolean;
  sortOrder: number;
};

/** Third market (BEEN, English for Belgium) is a hypothesis to confirm with the client. */
export const DEFAULT_MARKETS: MarketConfig[] = [
  { code: "BENL", country: "BE", language: "nl-BE", isDefault: true, sortOrder: 1 },
  { code: "BEFR", country: "BE", language: "fr-BE", isDefault: false, sortOrder: 2 },
  { code: "BEEN", country: "BE", language: "en-BE", isDefault: false, sortOrder: 3 },
];

export const IMPORT_LIMITS = {
  maxFileBytes: 10 * 1024 * 1024,
  maxUncompressedBytes: 120 * 1024 * 1024,
  maxKeywords: 20_000,
  maxRankings: 200_000,
  maxGeoRuns: 100_000,
  maxCells: 3_000_000,
};

export const POSITION_COLORS = {
  top3: "#C8E6C9",
  top10: "#DCEDC8",
  top20: "#FFF9C4",
  top50: "#FFE0B2",
  low: "#FFCDD2",
  none: "#F5F5F5",
};

export const BUCKET_COLORS = {
  top3: "#8B7355",
  "4-10": "#B8A99A",
  "11-20": "#D4C4B5",
  "21+": "#E5DDD4",
  unranked: "#C9A59A",
};

export const DISPLAY_TZ = "Europe/Brussels";

/** Account lockout after repeated wrong passwords. */
export const LOGIN_LOCK = { maxAttempts: 5, minutes: 15 };
