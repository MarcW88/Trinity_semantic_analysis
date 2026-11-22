import { describe, expect, it } from "vitest";
import { isBrandKeyword, withTrackedSerp, type Benchmark } from "@/lib/seo/benchmark";

describe("isBrandKeyword", () => {
  it.each([
    ["castaar", "castaar.com", true], ["kastaar", "castaar.com", true], ["castaar video", "castaar.com", true],
    ["het peloton", "hetpeloton.be", true], ["hannibal roeselare", "hannibal.be", true], ["gang tv", "gang.tv", true],
    ["gangster film", "gang.tv", false], ["lasemo", "duckmotion.be", false], ["tiktok shop", "socialsky.eu", false],
  ])("%s / %s → %s", (kw, domain, expected) => expect(isBrandKeyword(kw, domain)).toBe(expected));
});

describe("withTrackedSerp", () => {
  it("counts a query listed in several languages once", () => {
    const k = (language: string, traffic: number) => ({ keyword: "castaar", position: 1, url: "", volume: 720, traffic, cpc: null, language });
    const bench: Benchmark = { market: "BEFR", generatedAt: "", source: "", location: 2056, language: "fr", allLanguages: true, domains: [{
      domain: "castaar.com", total: 2, top3: 2, top10: 2, top20: 2, traffic: 706, trafficByRange: { top3: 706, "4-10": 0, "11-20": 0, "21+": 0 },
      keywords: [k("fr", 318), k("nl", 388)],
    }] };
    const [d] = withTrackedSerp(bench, {});
    expect(d).toMatchObject({ total: 1, top3: 1, top10: 1, traffic: 388 });
    expect(d.keywords).toHaveLength(1);
  });
});
