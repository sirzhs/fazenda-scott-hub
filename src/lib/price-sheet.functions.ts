import { createServerFn } from "@tanstack/react-start";

export const PRICE_SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1CI4JrqL20slQGdXbVDRi6i8nZQa3rrxERLNg1kl9v2w/edit?gid=0#gid=0";

const CSV_URL =
  "https://docs.google.com/spreadsheets/d/1CI4JrqL20slQGdXbVDRi6i8nZQa3rrxERLNg1kl9v2w/gviz/tq?tqx=out:csv&gid=0";

export type PriceItem = { name: string; min: number; max: number };
export type PriceSheet = { updatedAt: string | null; items: PriceItem[]; fetchedAt: string };

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += ch;
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (ch !== "\r") cell += ch;
  }
  row.push(cell);
  rows.push(row);
  return rows;
}

function money(value: string): number | null {
  const cleaned = value.replace(/[^0-9,.-]/g, "").replace(/\./g, "").replace(",", ".");
  const n = Number(cleaned);
  return Number.isFinite(n) && cleaned !== "" ? n : null;
}

export const fetchPriceSheet = createServerFn({ method: "GET" }).handler(
  async (): Promise<PriceSheet> => {
    const res = await fetch(CSV_URL, { headers: { "cache-control": "no-cache" } });
    if (!res.ok) throw new Error(`Não foi possível ler a planilha (${res.status}).`);
    const rows = parseCsv(await res.text());

    let updatedAt: string | null = null;
    const items: PriceItem[] = [];
    const seen = new Set<string>();

    for (const row of rows) {
      for (let c = 0; c < row.length; c++) {
        const cell = (row[c] ?? "").trim();
        if (!cell) continue;
        const dateMatch = cell.match(/Atualiza\S*\s*:?\s*(\d{2}\/\d{2}\/\d{4})/i);
        if (dateMatch && !updatedAt) updatedAt = dateMatch[1]!;
        const min = money((row[c + 1] ?? "").trim());
        const max = money((row[c + 2] ?? "").trim());
        if (min === null || max === null) continue;
        if (!/[a-zà-ú]/i.test(cell)) continue;
        const key = cell.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        items.push({ name: cell, min, max });
        c += 2;
      }
    }

    items.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    return { updatedAt, items, fetchedAt: new Date().toISOString() };
  },
);
