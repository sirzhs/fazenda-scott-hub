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
