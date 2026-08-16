export function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatQty(value: number) {
  return value.toLocaleString("pt-BR", { maximumFractionDigits: 3 });
}

export function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export const DEFAULT_PRODUCTS = [
  { name: "Álcool Artesanal", category: "Destilados", unit: "L", price: 0 },
  { name: "Álcool Industrial", category: "Destilados", unit: "L", price: 0 },
  { name: "Amido Vegetal", category: "Grãos e Farinhas", unit: "kg", price: 0 },
  { name: "Arroz Curado", category: "Grãos e Farinhas", unit: "kg", price: 0 },
  { name: "Carne Moída", category: "Carnes", unit: "kg", price: 0 },
  { name: "Bisteca", category: "Carnes", unit: "kg", price: 0 },
  { name: "Polpa de Morango", category: "Polpas e Frutas", unit: "kg", price: 0 },
  { name: "Polpa de Uva", category: "Polpas e Frutas", unit: "kg", price: 0 },
  { name: "Saca de Uva", category: "Polpas e Frutas", unit: "saca", price: 0 },
];

export const ORDER_STATUS: Record<string, { label: string; className: string }> = {
  pendente: { label: "Pendente", className: "bg-accent text-accent-foreground" },
  em_producao: { label: "Em produção", className: "bg-gold/20 text-gold-foreground" },
  entregue: { label: "Entregue", className: "bg-success/15 text-success" },
  cancelada: { label: "Cancelada", className: "bg-destructive/10 text-destructive" },
};

export const EXPENSE_CATEGORIES = [
  { value: "materia_prima", label: "Matéria-prima" },
  { value: "insumos", label: "Insumos" },
  { value: "equipamentos", label: "Equipamentos" },
  { value: "manutencao", label: "Manutenção" },
  { value: "transporte", label: "Transporte" },
  { value: "outros", label: "Outros" },
];

export function expenseCategoryLabel(value: string) {
  return EXPENSE_CATEGORIES.find((c) => c.value === value)?.label ?? value;
}

export const ANIMAL_CATEGORIES = [
  { value: "ovinos", label: "Ovinos" },
  { value: "aviarios", label: "Aviários" },
  { value: "suinos", label: "Suínos" },
  { value: "mulas", label: "Mulas" },
  { value: "gados", label: "Gados" },
];

export function animalCategoryLabel(value: string) {
  return ANIMAL_CATEGORIES.find((c) => c.value === value)?.label ?? value;
}

/* ------------------------------- Financeiro ------------------------------- */

export const FINANCE_KINDS = [
  { value: "pagar", label: "A pagar" },
  { value: "receber", label: "A receber" },
];

export type FinanceStatus = "pago" | "pendente" | "atrasado";

export const FINANCE_STATUS: Record<FinanceStatus, { label: string; dot: string; className: string }> = {
  pago: { label: "Pago", dot: "bg-success", className: "bg-success/15 text-success" },
  pendente: { label: "Pendente", dot: "bg-gold", className: "bg-gold/20 text-gold-foreground" },
  atrasado: { label: "Atrasado", dot: "bg-destructive", className: "bg-destructive/10 text-destructive" },
};

export function financeStatus(entry: { paid_at: string | null; due_date: string }): FinanceStatus {
  if (entry.paid_at) return "pago";
  return entry.due_date < todayISO() ? "atrasado" : "pendente";
}

/* --------------------------------- Datas --------------------------------- */

export function todayISO() {
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
}

/** "2026-08" for the given date (local time). */
export function monthKey(date: Date | string) {
  if (typeof date === "string") return date.slice(0, 7);
  const off = date.getTimezoneOffset();
  return new Date(date.getTime() - off * 60000).toISOString().slice(0, 7);
}

/** Last `count` month keys, oldest first (includes current month). */
export function lastMonthKeys(count: number) {
  const now = new Date();
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (count - 1 - i), 1);
    return monthKey(d);
  });
}

export function monthLabel(key: string) {
  const [y, m] = key.split("-").map(Number);
  const label = new Date(y, m - 1, 1).toLocaleDateString("pt-BR", { month: "long" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** Number of days between today and an ISO date (negative = past). */
export function daysFromToday(iso: string) {
  const a = new Date(`${todayISO()}T00:00:00`);
  const b = new Date(`${iso}T00:00:00`);
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

export function startOfWeekISO() {
  const d = new Date();
  const diff = (d.getDay() + 6) % 7; // segunda-feira
  d.setDate(d.getDate() - diff);
  return monthKey(d) + "-" + String(d.getDate()).padStart(2, "0") === "" ? "" : isoOf(d);
}

function isoOf(d: Date) {
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
}
