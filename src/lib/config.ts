export type UiLang = "fr" | "nl" | "en";
export const UI_LANGS: UiLang[] = ["fr", "nl", "en"];
export const DEFAULT_UI_LANG: UiLang = "fr";

export const CLIENT = { name: "Trinity", brandLabel: "Trinity" };

/** One folder per market under data/. BEEN (English for Belgium) is a hypothesis to confirm. */
export const MARKETS = [
  { code: "BENL", isDefault: true },
  { code: "BEFR", isDefault: false },
  { code: "BEEN", isDefault: false },
] as const;
export type MarketCode = (typeof MARKETS)[number]["code"];

/** Categories kept in the Excel but left out of every dashboard calculation. */
export const EXCLUDED_CATEGORIES = ["Branding", "Marque et valeurs"];

/** Brand colour for the client series; competitors cycle through COMPETITOR_COLORS in column order. */
export const CLIENT_COLOR = "#EA3323";
export const COMPETITOR_COLORS = ["#1F1F22", "#2563EB", "#0EA5E9", "#14B8A6", "#F59E0B", "#8B5CF6", "#6B7280", "#EC4899", "#84CC16", "#A16207"];

export const POSITION_COLORS = {
  top3: "#C8E6C9",
  top10: "#DCEDC8",
  top20: "#FFF9C4",
  top50: "#FFE0B2",
  low: "#FFCDD2",
  none: "#F5F5F5",
};

export const BUCKET_COLORS = {
  top3: "#EA3323",
  "4-10": "#F2766B",
  "11-20": "#F8B4AD",
  "21+": "#FCE0DC",
  unranked: "#D4D4D8",
};
