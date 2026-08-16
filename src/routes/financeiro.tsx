import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Check,
  Undo2,
  Wallet,
  ArrowDownCircle,
  ArrowUpCircle,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { AppLayout } from "@/components/farm/AppLayout";
import { Modal } from "@/components/farm/Modal";
import { ExportButtons } from "@/components/farm/ExportButtons";
import {
  FINANCE_STATUS,
  financeStatus,
  formatBRL,
  formatDate,
  todayISO,
  type FinanceStatus,
} from "@/lib/farm";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/financeiro")({
  head: () => ({
    meta: [
      { title: "Financeiro — Fazenda Scott" },
      {
        name: "description",
        content:
          "Contas a pagar e a receber, saldo disponível, entradas e saídas da Fazenda Scott.",
      },
      { property: "og:title", content: "Financeiro — Fazenda Scott" },
      {
        property: "og:description",
        content: "Controle de contas a pagar, contas a receber e saldo da Fazenda Scott.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <AppLayout>
      <FinancePage />
    </AppLayout>
  ),
});

type Entry = Tables<"finance_entries">;

const EMPTY = {
  kind: "pagar",
  party: "",
  description: "",
  amount: "",
  due_date: todayISO(),
  notes: "",
};

function FinancePage() {
  const { userId } = useAuth();
  const qc = useQueryClient();
  const reportRef = useRef<HTMLDivElement>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Entry | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [filter, setFilter] = useState<"todos" | FinanceStatus>("todos");

  const { data: entries = [] } = useQuery({
    queryKey: ["finance", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("finance_entries")
        .select("*")
        .order("due_date", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const { data: sales = [] } = useQuery({
    queryKey: ["sales", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.from("sales").select("total,date");
      if (error) throw error;
      return data;
    },
  });

  const { data: expenses = [] } = useQuery({
    queryKey: ["expenses", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.from("expenses").select("amount,date");
      if (error) throw error;
      return data;
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["finance"] });
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        kind: form.kind,
        party: form.party.trim(),
        description: form.description.trim() || null,
        amount: Number(form.amount) || 0,
        due_date: form.due_date || todayISO(),
        notes: form.notes.trim() || null,
      };
      if (editing) {
        const { error } = await supabase
          .from("finance_entries")
          .update(payload)
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("finance_entries").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Lançamento atualizado!" : "Lançamento criado!");
      setModalOpen(false);
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const togglePaid = useMutation({
    mutationFn: async (entry: Entry) => {
      const { error } = await supabase
        .from("finance_entries")
        .update({ paid_at: entry.paid_at ? null : todayISO() })
        .eq("id", entry.id);
      if (error) throw error;
    },
    onSuccess: () => invalidate(),
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("finance_entries").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Lançamento removido.");
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const totals = useMemo(() => {
    const salesTotal = sales.reduce((s, r) => s + Number(r.total), 0);
    const expensesTotal = expenses.reduce((s, r) => s + Number(r.amount), 0);
    const open = entries.filter((e) => !e.paid_at);
    const toPay = open.filter((e) => e.kind === "pagar");
    const toReceive = open.filter((e) => e.kind === "receber");
    const sum = (list: Entry[]) => list.reduce((s, e) => s + Number(e.amount), 0);
    return {
      salesTotal,
      expensesTotal,
      balance: salesTotal - expensesTotal,
      toPay: sum(toPay),
      toReceive: sum(toReceive),
      lateToPay: sum(toPay.filter((e) => financeStatus(e) === "atrasado")),
      lateToReceive: sum(toReceive.filter((e) => financeStatus(e) === "atrasado")),
      projected: salesTotal - expensesTotal + sum(toReceive) - sum(toPay),
    };
  }, [entries, sales, expenses]);

  const visible = entries.filter((e) => filter === "todos" || financeStatus(e) === filter);
  const byKind = (kind: string) => visible.filter((e) => e.kind === kind);

  const openNew = (kind: string) => {
    setEditing(null);
    setForm({ ...EMPTY, kind });
    setModalOpen(true);
  };

  const openEdit = (e: Entry) => {
    setEditing(e);
    setForm({
      kind: e.kind,
      party: e.party,
      description: e.description ?? "",
      amount: String(e.amount),
      due_date: e.due_date,
      notes: e.notes ?? "",
    });
    setModalOpen(true);
  };

  return (
    <div className="page-enter mx-auto max-w-5xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold lg:text-3xl">Financeiro</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Saldo, contas a pagar e contas a receber
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ExportButtons
            targetRef={reportRef}
            report={() => ({
              title: "Financeiro",
              columns: [
                { header: "Tipo" },
                { header: "Pessoa/Empresa" },
                { header: "Descrição" },
                { header: "Vencimento" },
                { header: "Status" },
                { header: "Valor", align: "right" },
              ],
              rows: entries.map((e) => [
                e.kind === "pagar" ? "A pagar" : "A receber",
                e.party,
                e.description ?? "—",
                formatDate(e.due_date),
                FINANCE_STATUS[financeStatus(e)].label,
                formatBRL(Number(e.amount)),
              ]),
              summary: [
                `Saldo disponivel: ${formatBRL(totals.balance)}`,
                `Contas a pagar em aberto: ${formatBRL(totals.toPay)}`,
                `Contas a receber em aberto: ${formatBRL(totals.toReceive)}`,
                `Saldo projetado: ${formatBRL(totals.projected)}`,
              ],
            })}
          />
          <button onClick={() => openNew("pagar")} className="btn-gold hover-lift">
            <Plus className="h-4 w-4" /> Novo lançamento
          </button>
        </div>
      </div>

      <div ref={reportRef} className="mt-6 space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MiniCard
            icon={<Wallet className="h-5 w-5" />}
            label="Saldo disponível"
            value={formatBRL(totals.balance)}
            tone={totals.balance >= 0 ? "positive" : "negative"}
          />
          <MiniCard
            icon={<ArrowUpCircle className="h-5 w-5" />}
            label="Entradas"
            value={formatBRL(totals.salesTotal)}
          />
          <MiniCard
            icon={<ArrowDownCircle className="h-5 w-5" />}
            label="Saídas"
            value={formatBRL(totals.expensesTotal)}
          />
          <MiniCard
            icon={<Wallet className="h-5 w-5" />}
            label="Saldo projetado"
            value={formatBRL(totals.projected)}
            tone={totals.projected >= 0 ? "positive" : "negative"}
            hint="Saldo + a receber − a pagar"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {(["todos", "pendente", "atrasado", "pago"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-all ${
                filter === f
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/60 text-muted-foreground hover:bg-muted"
              }`}
            >
              {f === "todos" ? "Todos" : FINANCE_STATUS[f].label}
            </button>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <EntryList
            title="Contas a pagar"
            total={totals.toPay}
            late={totals.lateToPay}
            entries={byKind("pagar")}
            onAdd={() => openNew("pagar")}
            onEdit={openEdit}
            onToggle={(e) => togglePaid.mutate(e)}
            onDelete={(e) => {
              if (confirm(`Remover "${e.party}"?`)) deleteMutation.mutate(e.id);
            }}
          />
          <EntryList
            title="Contas a receber"
            total={totals.toReceive}
            late={totals.lateToReceive}
            entries={byKind("receber")}
            onAdd={() => openNew("receber")}
            onEdit={openEdit}
            onToggle={(e) => togglePaid.mutate(e)}
            onDelete={(e) => {
              if (confirm(`Remover "${e.party}"?`)) deleteMutation.mutate(e.id);
            }}
          />
        </div>
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Editar lançamento" : "Novo lançamento"}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            saveMutation.mutate();
          }}
          className="space-y-3"
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-muted-foreground">Tipo *</label>
              <select
                className="input-farm"
                value={form.kind}
                onChange={(e) => setForm({ ...form, kind: e.target.value })}
              >
                <option value="pagar">A pagar (fornecedor)</option>
                <option value="receber">A receber (cliente)</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-muted-foreground">
                Vencimento *
              </label>
              <input
                type="date"
                required
                className="input-farm"
                value={form.due_date}
                onChange={(e) => setForm({ ...form, due_date: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted-foreground">
              Pessoa / Empresa *
            </label>
            <input
              required
              className="input-farm"
              value={form.party}
              onChange={(e) => setForm({ ...form, party: e.target.value })}
              placeholder="Ex.: Fornecedor A, Cliente João"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-muted-foreground">
                Descrição
              </label>
              <input
                className="input-farm"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Ex.: Ração, venda de polpas"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-muted-foreground">
                Valor (R$) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                className="input-farm"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted-foreground">
              Observações
            </label>
            <textarea
              rows={2}
              className="input-farm"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
          <button
            type="submit"
            disabled={saveMutation.isPending}
            className="btn-primary w-full justify-center"
          >
            {saveMutation.isPending ? "Salvando..." : "Salvar"}
          </button>
        </form>
      </Modal>
    </div>
  );
}

function EntryList({
  title,
  total,
  late,
  entries,
  onAdd,
  onEdit,
  onToggle,
  onDelete,
}: {
  title: string;
  total: number;
  late: number;
  entries: Entry[];
  onAdd: () => void;
  onEdit: (e: Entry) => void;
  onToggle: (e: Entry) => void;
  onDelete: (e: Entry) => void;
}) {
  return (
    <section className="card-farm p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">{title}</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Em aberto: <span className="font-semibold text-foreground">{formatBRL(total)}</span>
            {late > 0 && (
              <span className="ml-2 font-semibold text-destructive">
                · {formatBRL(late)} atrasado
              </span>
            )}
          </p>
        </div>
        <button onClick={onAdd} className="btn-outline hover-lift text-xs">
          <Plus className="h-3.5 w-3.5" /> Adicionar
        </button>
      </div>
      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum lançamento aqui.</p>
      ) : (
        <ul className="divide-y divide-border">
          {entries.map((e) => {
            const st = FINANCE_STATUS[financeStatus(e)];
            return (
              <li key={e.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium">{e.party}</p>
                  <p className="text-xs text-muted-foreground">
                    {e.description ? `${e.description} · ` : ""}Venc. {formatDate(e.due_date)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span
                    className={`hidden items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold sm:inline-flex ${st.className}`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />
                    {st.label}
                  </span>
                  <span className="font-semibold">{formatBRL(Number(e.amount))}</span>
                  <button
                    onClick={() => onToggle(e)}
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                    aria-label={e.paid_at ? "Reabrir lançamento" : "Marcar como pago"}
                    title={e.paid_at ? "Reabrir" : "Marcar como pago"}
                  >
                    {e.paid_at ? <Undo2 className="h-4 w-4" /> : <Check className="h-4 w-4" />}
                  </button>
                  <button
                    onClick={() => onEdit(e)}
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                    aria-label={`Editar ${e.party}`}
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => onDelete(e)}
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    aria-label={`Remover ${e.party}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function MiniCard({
  icon,
  label,
  value,
  tone,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone?: "positive" | "negative";
  hint?: string;
}) {
  return (
    <div className="card-farm hover-lift p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <span className="rounded-md bg-accent p-1.5 text-accent-foreground">{icon}</span>
        <span className="text-xs font-semibold uppercase tracking-wide">{label}</span>
      </div>
      <p
        className={`mt-3 text-2xl font-bold ${
          tone === "positive"
            ? "text-success"
            : tone === "negative"
              ? "text-destructive"
              : "text-card-foreground"
        }`}
      >
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
