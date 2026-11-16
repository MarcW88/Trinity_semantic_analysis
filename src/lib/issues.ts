export type Issue = {
  level: "error" | "warning";
  code: string;
  sheet?: string;
  row?: number;
  field?: string;
  value?: string;
  params?: Record<string, string | number>;
};

export class IssueList {
  items: Issue[] = [];
  error(code: string, ctx: Omit<Issue, "level" | "code"> = {}) { this.items.push({ level: "error", code, ...ctx }); }
  warn(code: string, ctx: Omit<Issue, "level" | "code"> = {}) { this.items.push({ level: "warning", code, ...ctx }); }
  get errors() { return this.items.filter((i) => i.level === "error"); }
  get warnings() { return this.items.filter((i) => i.level === "warning"); }
  hasErrors() { return this.items.some((i) => i.level === "error"); }
}

export function showValue(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString();
  const s = String(v);
  return s.length > 120 ? s.slice(0, 117) + "…" : s;
}
