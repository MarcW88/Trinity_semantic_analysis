export type WebSearch = "on" | "off" | "unknown";
export type GeoQuestionRow = {
  questionId: string; questionVersion: number; question: string; status: "active" | "archived";
  categoryId: string | null; seoKeywordId: string | null; persona: string | null; topicGroupId: string | null;
};
export type GeoCitationRow = { citedUrl: string; host: string; citationOrder: number | null };
export type GeoRunRow = {
  runId: string; questionId: string; questionVersion: number; observedAt: string; platform: string; model: string;
  webSearch: WebSearch; status: "success" | "error"; brandMentioned: boolean | null; answerText: string | null;
  errorCode: string | null; replacesRunId: string | null; citations: GeoCitationRow[]; contentHash: string;
};
export type GeoBatch = {
  market: string; source: string; collectedFrom: string; collectedTo: string; notes: string | null;
  questions: GeoQuestionRow[]; runs: GeoRunRow[];
};

/** Normalized view consumed by the pure GEO computations. */
export type GeoQuestionInfo = {
  questionId: string; status: "active" | "archived"; categoryId: string | null;
  versions: { version: number; question: string; createdAt: string | null }[];
};
export type GeoRunInfo = {
  runId: string; questionId: string; questionVersion: number; observedAt: string; platform: string; model: string;
  webSearch: WebSearch; status: "success" | "error"; brandMentioned: boolean | null; answerText: string | null; errorCode: string | null;
  citations: { citedUrl: string; host: string; citationOrder: number | null }[];
  invalidatedAt: string | null; invalidReason: string | null; replacesRunId: string | null;
};
export type Granularity = "week" | "month";
export type GeoFilters = {
  from: string | null; to: string | null; platform: string; webSearch: "all" | WebSearch; category: string; granularity: Granularity;
};
