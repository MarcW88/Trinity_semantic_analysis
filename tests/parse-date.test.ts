import { describe, expect, it } from "vitest";
import { parseIsoDate } from "@/lib/xlsx/read";
import { IssueList } from "@/lib/issues";

describe("parseIsoDate", () => {
  it.each(["2026-02-31", "2026-13-01", "2026-00-10", "2026-04-7"])("rejects %s as a field error", (v) => {
    const issues = new IssueList();
    expect(parseIsoDate(v, "snapshot_date", { issues, sheet: "Meta", row: 2 })).toBeNull();
    expect(issues.items.map((i) => i.code)).toEqual(["field.date"]);
  });
  it("accepts a real date", () => {
    expect(parseIsoDate("2024-02-29", "snapshot_date", { issues: new IssueList(), sheet: "Meta", row: 2 })).toBe("2024-02-29");
  });
});
