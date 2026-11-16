import { DISPLAY_TZ } from "../config";
import { hostMatches } from "./contract";
import type { GeoFilters, GeoQuestionInfo, GeoRunInfo, Granularity } from "./types";

export const isValidRun = (r: GeoRunInfo) => r.status === "success" && !r.invalidatedAt;
export const runCitesClient = (r: GeoRunInfo, domains: string[]) => r.citations.some((c) => hostMatches(c.host, domains));
const rate = (n: number, d: number) => (d > 0 ? n / d : null);

const dayFmt = new Intl.DateTimeFormat("en-CA", { timeZone: DISPLAY_TZ, year: "numeric", month: "2-digit", day: "2-digit" });
/** Local calendar day (YYYY-MM-DD) of a UTC instant in Europe/Brussels. */
export function localDay(iso: string): string {
  return dayFmt.format(new Date(iso));
}

export function periodKey(iso: string, g: Granularity): string {
  const day = localDay(iso);
  if (g === "month") return day.slice(0, 7);
  const d = new Date(day + "T00:00:00Z");
  const dow = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dow + 3);
  const year = d.getUTCFullYear();
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const week = 1 + Math.round(((d.getTime() - jan4.getTime()) / 86400000 - 3 + ((jan4.getUTCDay() + 6) % 7)) / 7);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

/** All period keys between two local days (inclusive) so periods without data appear as gaps. */
export function periodRange(fromDay: string, toDay: string, g: Granularity): string[] {
  const out: string[] = [];
  const d = new Date(fromDay + "T12:00:00Z");
  const end = new Date(toDay + "T12:00:00Z");
  while (d <= end && out.length < 520) {
    const k = periodKey(d.toISOString(), g);
    if (!out.includes(k)) out.push(k);
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

export function filterRuns(runs: GeoRunInfo[], questions: Map<string, GeoQuestionInfo>, f: GeoFilters): GeoRunInfo[] {
  return runs.filter((r) => {
    const day = localDay(r.observedAt);
    if (f.from && day < f.from) return false;
    if (f.to && day > f.to) return false;
    if (f.platform !== "all" && r.platform !== f.platform) return false;
    if (f.webSearch !== "all" && r.webSearch !== f.webSearch) return false;
    if (f.category !== "all" && questions.get(r.questionId)?.categoryId !== f.category) return false;
    return true;
  });
}

export function computeGeo(questionList: GeoQuestionInfo[], allRuns: GeoRunInfo[], domains: string[], f: GeoFilters) {
  const questions = new Map(questionList.map((q) => [q.questionId, q]));
  const runs = filterRuns(allRuns, questions, f);
  const valid = runs.filter(isValidRun);
  const inCategory = (q: GeoQuestionInfo) => f.category === "all" || q.categoryId === f.category;

  const tracked = questionList.filter((q) => q.status === "active" && inCategory(q)).length;
  const observed = new Set(valid.map((r) => r.questionId)).size;
  const present = valid.filter((r) => r.brandMentioned === true).length;
  const cited = valid.filter((r) => runCitesClient(r, domains)).length;
  const cards = {
    tracked, observed, runs: runs.length, valid: valid.length,
    errors: runs.filter((r) => r.status === "error" && !r.invalidatedAt).length,
    invalidated: runs.filter((r) => r.invalidatedAt).length,
    presenceRate: rate(present, valid.length), citationRate: rate(cited, valid.length), present, cited,
  };

  const platforms = [...new Set(allRuns.map((r) => r.platform))].sort();
  const days = runs.map((r) => localDay(r.observedAt)).sort();
  const from = f.from ?? days[0];
  const to = f.to ?? days[days.length - 1];
  const periods = from && to ? periodRange(from, to, f.granularity) : [];
  const shownPlatforms = f.platform === "all" ? platforms : [f.platform];
  const timeline = periods.map((p) => {
    const row: Record<string, string | number | null> = { period: p };
    for (const pl of shownPlatforms) {
      const vr = valid.filter((r) => r.platform === pl && periodKey(r.observedAt, f.granularity) === p);
      row[`presence:${pl}`] = rate(vr.filter((r) => r.brandMentioned === true).length, vr.length);
      row[`citation:${pl}`] = rate(vr.filter((r) => runCitesClient(r, domains)).length, vr.length);
      row[`n:${pl}`] = vr.length;
    }
    return row;
  });

  const list = questionList.filter(inCategory).map((q) => {
    const qr = runs.filter((r) => r.questionId === q.questionId);
    const qv = qr.filter(isValidRun);
    const latest = [...q.versions].sort((a, b) => b.version - a.version)[0];
    const last = qr.map((r) => r.observedAt).sort().pop() ?? null;
    const p = qv.filter((r) => r.brandMentioned === true).length;
    const c = qv.filter((r) => runCitesClient(r, domains)).length;
    return {
      questionId: q.questionId, question: latest?.question ?? q.questionId, version: latest?.version ?? 1, status: q.status, categoryId: q.categoryId,
      runs: qr.length, valid: qv.length, errors: qr.filter((r) => r.status === "error").length,
      presenceRate: rate(p, qv.length), citationRate: rate(c, qv.length), brandPresent: p > 0,
      platforms: [...new Set(qr.map((r) => r.platform))].sort(), lastObservedAt: last,
    };
  });

  return { cards, platforms, shownPlatforms, timeline, questions: list };
}

export type GeoResult = ReturnType<typeof computeGeo>;
