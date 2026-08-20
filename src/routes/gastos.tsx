import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { AppLayout } from "@/components/farm/AppLayout";
import { Modal } from "@/components/farm/Modal";
import { ExportButtons } from "@/components/farm/ExportButtons";
import { formatBRL, formatDate, EXPENSE_CATEGORIES, expenseCategoryLabel } from "@/lib/farm";
import { notifyDiscord } from "@/lib/discord-notify";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/gastos")({
  head: () => ({ meta: [{ title: "Gastos — Fazenda Scott" }] }),
  component: () => (
    <AppLayout>
      <ExpensesPage />
    </AppLayout>
  ),
});

type Expense = Tables<"expenses">;

const EMPTY = {
  description: "",
  category: "materia_prima",
  amount: "",
  date: new Date().toISOString().slice(0, 10),
  notes: "",
};

function ExpensesPage() {
  const { userId } = useAuth();
  const qc = useQueryClient();
  const reportRef = useRef<HTMLDivElement>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [form, setForm] = useState(EMPTY);

  const { data: expenses = [] } = useQuery({
    queryKey: ["expenses", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select("*")
        .order("date", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const total = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const invalidate = () => qc.invalidateQueries({ queryKey: ["expenses"] });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const amount = Number(form.amount);
      if (!amount || amount <= 0) throw new Error("Informe um valor válido.");
      const payload = {
        description: form.description.trim(),
        category: form.category,
        amount,
        date: form.date,
        notes: form.notes.trim() || null,
      };
      if (editing) {
        const { error } = await supabase.from("expenses").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("expenses").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      notifyDiscord({
        module: "Gastos",
        action: editing ? "atualizado" : "criado",
        summary: `${form.description.trim()} — ${formatBRL(Number(form.amount))}`,
        fields: [
          { name: "Categoria", value: expenseCategoryLabel(form.category) },
          { name: "Data", value: formatDate(form.date) },
        ],
      });
      toast.success(editing ? "Gasto atualizado!" : "Gasto registrado!");
      setModalOpen(false);
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (expense: Expense) => {
      const { error } = await supabase.from("expenses").delete().eq("id", expense.id);
      if (error) throw error;
      return expense;
    },
    onSuccess: (expense) => {
      notifyDiscord({
        module: "Gastos",
        action: "removido",
        summary: `Gasto removido: ${expense.description} (${formatBRL(Number(expense.amount))}).`,
      });
      toast.success("Gasto removido.");
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const openEdit = (ex: Expense) => {
    setEditing(ex);
    setForm({
      description: ex.description,
      category: ex.category,
      amount: String(ex.amount),
      date: ex.date,
      notes: ex.notes ?? "",
    });
    setModalOpen(true);
  };

  return (
    <div className="page-enter mx-auto max-w-5xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold lg:text-3xl">Gastos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Total gasto: <span className="font-bold text-destructive">{formatBRL(total)}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
        <ExportButtons
          targetRef={reportRef}
          report={() => ({
            title: "Gastos",
            columns: [
              { header: "Data" },
              { header: "Descrição" },
              { header: "Categoria" },
              { header: "Valor", align: "right" },
            ],
            rows: expenses.map((ex) => [
              formatDate(ex.date),
              ex.description,
              expenseCategoryLabel(ex.category),
              formatBRL(Number(ex.amount)),
            ]),
            summary: [`Total gasto: ${formatBRL(total)}`],
          })}
        />

          <button
            onClick={() => {
              setEditing(null);
              setForm(EMPTY);
              setModalOpen(true);
            }}
            className="btn-gold hover-lift"
          >
            <Plus className="h-4 w-4" /> Novo gasto
          </button>
        </div>
      </div>

      {expenses.length > 0 ? (
        <div ref={reportRef} className="mt-6 overflow-x-auto card-farm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Descrição</th>
                <th className="px-4 py-3">Categoria</th>
                <th className="px-4 py-3 text-right">Valor</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {expenses.map((ex) => (
                <tr key={ex.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3">{formatDate(ex.date)}</td>
                  <td className="px-4 py-3 font-medium">{ex.description}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-accent-foreground">
                      {expenseCategoryLabel(ex.category)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-destructive">
                    {formatBRL(Number(ex.amount))}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => openEdit(ex)}
                        className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                        aria-label="Editar gasto"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm("Remover este gasto?")) deleteMutation.mutate(ex.id);
                        }}
                        className="rounded-md p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        aria-label="Remover gasto"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-10 text-center text-sm text-muted-foreground">
          Nenhum gasto registrado ainda.
        </p>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Editar gasto" : "Novo gasto"}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            saveMutation.mutate();
          }}
          className="space-y-3"
        >
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted-foreground">Descrição *</label>
            <input
              required
              className="input-farm"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Ex.: Compra de uva para polpa"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-muted-foreground">Categoria</label>
              <select
                className="input-farm"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-muted-foreground">Valor (R$) *</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                className="input-farm"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted-foreground">Data</label>
            <input
              type="date"
              className="input-farm"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted-foreground">Observações</label>
            <input
              className="input-farm"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Opcional"
            />
          </div>
          <button type="submit" disabled={saveMutation.isPending} className="btn-primary w-full justify-center">
            {saveMutation.isPending ? "Salvando..." : "Salvar"}
          </button>
        </form>
      </Modal>
    </div>
  );
}
