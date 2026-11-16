import ExcelJS from "exceljs";

export type SheetSpec = { name: string; headers: string[]; rows: (string | number | boolean | null)[][]; widths?: number[] };

export async function buildWorkbook(sheets: SheetSpec[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "DeDecker Dashboard";
  for (const s of sheets) {
    const ws = wb.addWorksheet(s.name);
    ws.addRow(s.headers);
    ws.getRow(1).font = { bold: true };
    ws.views = [{ state: "frozen", ySplit: 1 }];
    for (const r of s.rows) ws.addRow(r.map((v) => (v === null ? undefined : v)));
    s.headers.forEach((h, i) => { ws.getColumn(i + 1).width = s.widths?.[i] ?? Math.min(60, Math.max(12, h.length + 4)); });
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}
