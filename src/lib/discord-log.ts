/**
 * Interpretador tolerante das logs do canal do Discord (bot do servidor).
 * Aceita formatos variados, por exemplo:
 *   [19/08/2026 14:32] Jefnho depositou 30x Polpa de Uva no baú
 *   19/08/2026 14:32 - Jefnho retirou 10 Carne Moída do bau
 *   Jefnho vendeu 5x Bisteca por $250,00 na loja
 *   Jefnho depositou $1.500,00 no cofre da fazenda
 *   Jefnho abasteceu a loja com 20x Amido Vegetal
 */

export type LogKind =
  | "estoque_entrada"
  | "estoque_saida"
  | "venda"
  | "dinheiro_entrada"
  | "dinheiro_saida"
  | "gasto";

export type ParsedLog = {
  hash: string;
  raw: string;
  kind: LogKind;
  actor: string | null;
  item: string | null;
  quantity: number | null;
  amount: number | null;
  /** Data (YYYY-MM-DD) extraída da log, quando existir. */
  date: string | null;
  loggedAt: string | null;
};

export const LOG_KIND_LABEL: Record<LogKind, string> = {
  estoque_entrada: "Entrada de estoque",
  estoque_saida: "Saída de estoque",
  venda: "Venda",
  dinheiro_entrada: "Depósito de dinheiro",
  dinheiro_saida: "Retirada de dinheiro",
  gasto: "Gasto / abastecimento",
};

const IN_VERBS = /\b(depositou|deposito|depósito|guardou|colocou|adicionou|inseriu|estocou)\b/i;
const OUT_VERBS = /\b(retirou|retirada|pegou|removeu|sacou|saque|tirou)\b/i;
const SALE_VERBS = /\b(vendeu|venda|vendas|vendido)\b/i;
const BUY_VERBS = /\b(comprou|compra|abasteceu|abastecimento|abastecer|insumo|insumos|pagou|pagamento)\b/i;

/** Hash estável (djb2) usado para não importar a mesma log duas vezes. */
export function hashLine(line: string) {
  const normalized = normalize(line);
  let h = 5381;
  for (let i = 0; i < normalized.length; i++) {
    h = ((h << 5) + h + normalized.charCodeAt(i)) >>> 0;
  }
  let h2 = 52711;
  for (let i = normalized.length - 1; i >= 0; i--) {
    h2 = ((h2 << 5) + h2 + normalized.charCodeAt(i)) >>> 0;
  }
  return `${h.toString(16)}${h2.toString(16)}`;
}

function normalize(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseMoney(line: string): number | null {
  const match =
    line.match(/(?:r?\$|\bus\$)\s*([\d.,]+)/i) ??
    line.match(/([\d.,]+)\s*(?:reais|dolares|dólares|dinheiro)/i);
  if (!match?.[1]) return null;
  const value = toNumber(match[1]);
  return value && value > 0 ? value : null;
}

function toNumber(raw: string) {
  let text = raw.trim();
  if (text.includes(",") && text.includes(".")) {
    text = text.replace(/\./g, "").replace(",", ".");
  } else if (text.includes(",")) {
    text = text.replace(",", ".");
  } else if (/\.\d{3}\b/.test(text)) {
    text = text.replace(/\./g, "");
  }
  const value = Number(text);
  return Number.isFinite(value) ? value : null;
}

function parseDate(line: string): { date: string | null; loggedAt: string | null } {
  const m = line.match(/(\d{2})[/-](\d{2})(?:[/-](\d{2,4}))?(?:[\s,]+(\d{1,2}):(\d{2}))?/);
  if (!m) return { date: null, loggedAt: null };
  const day = m[1]!;
  const month = m[2]!;
  let year = m[3] ?? String(new Date().getFullYear());
  if (year.length === 2) year = `20${year}`;
  const date = `${year}-${month}-${day}`;
  if (Number(month) > 12) return { date: null, loggedAt: null };
  const hour = m[4] ? m[4].padStart(2, "0") : "00";
  const minute = m[5] ?? "00";
  const iso = new Date(`${date}T${hour}:${minute}:00`);
  return {
    date,
    loggedAt: Number.isNaN(iso.getTime()) ? null : iso.toISOString(),
  };
}

function parseActor(line: string): string | null {
  const cleaned = line
    .replace(/^\s*[[(]?[^\])]*\d{2}:\d{2}[^\])]*[\])]?\s*[-–:]?\s*/, "")
    .replace(/^\s*[[(][^\])]+[\])]\s*[-–:]?\s*/, "")
    .trim();
  const m = cleaned.match(
    /^([A-Za-zÀ-ÿ][\wÀ-ÿ.'-]*(?:\s+[A-Za-zÀ-ÿ][\wÀ-ÿ.'-]*)?)\s+(?:depositou|guardou|colocou|adicionou|inseriu|estocou|retirou|pegou|removeu|sacou|tirou|vendeu|comprou|abasteceu|pagou)/i,
  );
  return m?.[1]?.trim() ?? null;
}

function parseItem(line: string): { item: string | null; quantity: number | null } {
  // "30x Polpa de Uva" / "30 x Polpa de Uva" / "30 Polpa de Uva"
  const before = line.match(
    /(\d+(?:[.,]\d+)?)\s*(?:x|un|unidades?|kg|l|sacas?|litros?)?\s*(?:de\s+)?([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s.'-]{2,40})/,
  );
  // "Polpa de Uva x30"
  const after = line.match(/([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s.'-]{2,40}?)\s*[x*]\s*(\d+(?:[.,]\d+)?)/i);

  let quantity: number | null = null;
  let item: string | null = null;

  if (before) {
    quantity = toNumber(before[1]!);
    item = before[2]!;
  } else if (after) {
    quantity = toNumber(after[2]!);
    item = after[1]!;
  }

  if (item) {
    item = item
      .replace(
        /\b(no|na|do|da|de|dos|das|para|pra|ao|aos|em|com|por|bau|baú|cofre|loja|fazenda|estoque|banco|caixa)\b.*$/i,
        "",
      )
      .replace(/[^A-Za-zÀ-ÿ\s.'-]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (item.length < 3) item = null;
  }

  return { item, quantity: quantity && quantity > 0 ? quantity : null };
}

/** Interpreta uma única linha. Retorna null quando não reconhece nada útil. */
export function parseLogLine(raw: string): ParsedLog | null {
  const line = raw.trim();
  if (!line || line.length < 6) return null;

  const amount = parseMoney(line);
  const { item, quantity } = parseItem(line.replace(/(?:r?\$|\bus\$)\s*[\d.,]+/gi, " "));
  const { date, loggedAt } = parseDate(line);
  const actor = parseActor(line);

  const isIn = IN_VERBS.test(line);
  const isOut = OUT_VERBS.test(line);
  const isSale = SALE_VERBS.test(line);
  const isBuy = BUY_VERBS.test(line);

  let kind: LogKind | null = null;

  if (isSale) kind = "venda";
  else if (isBuy && amount) kind = "gasto";
  else if (amount && !item && isIn) kind = "dinheiro_entrada";
  else if (amount && !item && isOut) kind = "dinheiro_saida";
  else if (isIn && (item || quantity)) kind = "estoque_entrada";
  else if (isOut && (item || quantity)) kind = "estoque_saida";
  else if (isBuy && (item || quantity)) kind = "gasto";
  else if (amount && isIn) kind = "dinheiro_entrada";
  else if (amount && isOut) kind = "dinheiro_saida";

  if (!kind) return null;
  if (kind === "venda" && !item && !amount) return null;
  if ((kind === "estoque_entrada" || kind === "estoque_saida") && !item) return null;

  return {
    hash: hashLine(line),
    raw: line,
    kind,
    actor,
    item,
    quantity,
    amount,
    date,
    loggedAt,
  };
}

/** Interpreta um bloco colado do Discord, ignorando linhas irreconhecíveis. */
export function parseLogBlock(text: string) {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const parsed: ParsedLog[] = [];
  const ignored: string[] = [];
  const seen = new Set<string>();

  for (const line of lines) {
    const result = parseLogLine(line);
    if (!result) {
      ignored.push(line);
      continue;
    }
    if (seen.has(result.hash)) continue; // duplicada no próprio bloco colado
    seen.add(result.hash);
    parsed.push(result);
  }

  return { parsed, ignored, total: lines.length };
}

/** Casa o item da log com um produto cadastrado (comparação sem acento/caixa). */
export function matchProduct<T extends { id: string; name: string }>(
  products: T[],
  item: string | null,
): T | null {
  if (!item) return null;
  const target = normalize(item);
  const exact = products.find((p) => normalize(p.name) === target);
  if (exact) return exact;
  return (
    products.find(
      (p) => normalize(p.name).includes(target) || target.includes(normalize(p.name)),
    ) ?? null
  );
}
