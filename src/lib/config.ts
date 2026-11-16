export type UiLang = "fr" | "nl" | "en";
export const UI_LANGS: UiLang[] = ["fr", "nl", "en"];
export const DEFAULT_UI_LANG: UiLang = "fr";

export const CLIENT = { name: "DeDecker Keukens", brandLabel: "DeDecker" };

/** One folder per market under data/. BEEN (English for Belgium) is a hypothesis to confirm. */
export const MARKETS = [
  { code: "BENL", isDefault: true },
  { code: "BEFR", isDefault: false },
  { code: "BEEN", isDefault: false },
] as const;
export type MarketCode = (typeof MARKETS)[number]["code"];

/** Categories kept in the Excel but left out of every dashboard calculation. */
export const EXCLUDED_CATEGORIES = ["Branding", "Marque et valeurs"];

/** Display names and colours for known competitor domains; unknown domains show the domain itself. */
export const KNOWN_COMPETITORS: Record<string, { label: string; color: string }> = {
  "vika.be": { label: "Vika", color: "#C4956A" },
  "dsmkeukens.be": { label: "DSM Keukens", color: "#4A90A4" },
  "dovykeukens.be": { label: "Dovy", color: "#7A9E7E" },
  "diapal.be": { label: "Diapal", color: "#D4A87C" },
  "ilwa.be": { label: "Ilwa", color: "#9C8AA5" },
  "cuisinesdovy.be": { label: "Dovy", color: "#7A9E7E" },
  "ixina.be": { label: "Ixina", color: "#4A90A4" },
  "vandenborrekitchen.be": { label: "Vandenborre", color: "#C4956A" },
  "dsmcuisines.be": { label: "DSM Cuisines", color: "#D4A87C" },
  "groepwouters.be": { label: "Groep Wouters", color: "#6AAFC3" },
  "debadbeke.be": { label: "De Badbeke", color: "#A3B18A" },
  "x2o.be": { label: "X2O", color: "#B07D56" },
  "facq.be": { label: "Facq", color: "#82C0D2" },
  "vanmarcke.com": { label: "Vanmarcke", color: "#9C8AA5" },
  "sanijura.be": { label: "Sanijura", color: "#6AAFC3" },
  "mobalpa.be": { label: "Mobalpa", color: "#A3B18A" },
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
