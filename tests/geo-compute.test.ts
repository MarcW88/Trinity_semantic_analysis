import { describe, expect, it } from "vitest";
import { computeGeo, localDay, periodKey, periodRange } from "@/lib/geo/compute";
import type { GeoFilters, GeoQuestionInfo, GeoRunInfo } from "@/lib/geo/types";

const F: GeoFilters = { from: null, to: null, platform: "all", webSearch: "all", category: "all", granularity: "week" };
const q = (id: string, status: "active" | "archived" = "active", categoryId = "salons"): GeoQuestionInfo => ({ questionId: id, status, categoryId, versions: [{ version: 1, question: id, createdAt: null }] });
let n = 0;
const run = (o: Partial<GeoRunInfo>): GeoRunInfo => ({
  runId: `r${++n}`, questionId: "Q1", questionVersion: 1, observedAt: "2026-03-03T10:00:00Z", platform: "chatgpt", model: "m", webSearch: "on",
  status: "success", brandMentioned: false, answerText: null, errorCode: null, citations: [], invalidatedAt: null, invalidReason: null, replacesRunId: null, ...o,
});
const cite = (url: string) => ({ citedUrl: url, host: new URL(url).hostname.replace(/^www\./, ""), citationOrder: null });

describe("R05 GEO rates", () => {
  const questions = [q("Q1"), q("Q2"), q("Q3", "archived")];
  const runs = [
    run({ brandMentioned: true, citations: [cite("https://www.dedecker.be/a"), cite("https://dedecker.be/b"), cite("https://shop.dedecker.be/c")] }),
    run({ brandMentioned: false }),
    run({ status: "error", brandMentioned: null, errorCode: "timeout" }),
    run({ questionId: "Q2", brandMentioned: true, invalidatedAt: "2026-03-05T00:00:00Z", invalidReason: "bad" }),
  ];
  const r = computeGeo(questions, runs, ["dedecker.be"], F);

  it("counts tracked/observed/valid and excludes errors and invalidated runs from rates", () => {
    expect(r.cards).toMatchObject({ tracked: 2, observed: 1, runs: 4, valid: 2, errors: 1, invalidated: 1, present: 1, cited: 1 });
    expect(r.cards.presenceRate).toBe(0.5);
    expect(r.cards.citationRate).toBe(0.5);
  });

  it("returns null (dash) when there is no valid response", () => {
    const e = computeGeo(questions, [run({ status: "error", brandMentioned: null })], ["dedecker.be"], F);
    expect(e.cards.presenceRate).toBeNull();
    expect(e.cards.citationRate).toBeNull();
    expect(e.questions.find((x) => x.questionId === "Q2")!.presenceRate).toBeNull();
  });

  it("does not match look-alike domains", () => {
    const x = computeGeo(questions, [run({ citations: [cite("https://notdedecker.be/x"), cite("https://dedecker.be.evil.com/")] })], ["dedecker.be"], F);
    expect(x.cards.cited).toBe(0);
  });
});

describe("R06 GEO timeline", () => {
  it("keeps gaps as null for periods without valid responses", () => {
    const runs = [run({ observedAt: "2026-03-02T09:00:00Z", brandMentioned: true }), run({ observedAt: "2026-03-17T09:00:00Z" })];
    const r = computeGeo([q("Q1")], runs, ["dedecker.be"], F);
    expect(r.timeline.map((t) => t.period)).toHaveLength(3);
    expect(r.timeline.map((t) => t["presence:chatgpt"])).toEqual([1, null, 0]);
  });

  it("uses Europe/Brussels local days", () => {
    expect(localDay("2026-03-01T23:30:00Z")).toBe("2026-03-02");
    expect(localDay("2026-07-01T21:59:00Z")).toBe("2026-07-01");
    expect(localDay("2026-07-01T22:00:00Z")).toBe("2026-07-02");
    expect(periodKey("2026-03-15T12:00:00Z", "month")).toBe("2026-03");
    expect(periodRange("2026-01-15", "2026-03-02", "month")).toEqual(["2026-01", "2026-02", "2026-03"]);
  });

  it("filters by platform, web search, category and date", () => {
    const runs = [run({ platform: "gemini", webSearch: "unknown" }), run({ platform: "chatgpt", observedAt: "2026-04-01T10:00:00Z" })];
    expect(computeGeo([q("Q1")], runs, [], { ...F, platform: "gemini" }).cards.runs).toBe(1);
    expect(computeGeo([q("Q1")], runs, [], { ...F, webSearch: "on" }).cards.runs).toBe(1);
    expect(computeGeo([q("Q1")], runs, [], { ...F, from: "2026-03-10" }).cards.runs).toBe(1);
    expect(computeGeo([q("Q1")], runs, [], { ...F, category: "other" }).cards.runs).toBe(0);
  });
});
