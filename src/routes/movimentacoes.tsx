import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Trash2, ArrowDownCircle, ArrowUpCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { AppLayout } from "@/components/farm/AppLayout";
import { Modal } from "@/components/farm/Modal";
import { formatQty, formatDate } from "@/lib/farm";

export const Route = createFileRoute("/movimentacoes")({
  head: () => ({ meta: [{ title: "Entradas e Saídas — Fazenda Scott" }] }),
  component: () => (
    <AppLayout>
      <MovementsPage />
    </AppLayout>
  ),
});

const EMPTY = {
  product_id: "",
  type: "entrada" as "entrada" | "saida",
  quantity: "",
  date: new Date().toISOString().slice(0, 10),
  notes: "",
};

function MovementsPage() {
  const { userId } = useAuth();
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);

  const { data: products = [] } = useQuery({
    queryKey: ["products", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: movements = [] } = useQuery({
    queryKey: ["movements", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("movements")
        .select("*, products(name, unit)")
        .order("date", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["movements"] });
    qc.invalidateQueries({ queryKey: ["products"] });
  };

  const addMutation = useMutation({
    mutationFn: async () => {
      const qty = Number(form.quantity);
      if (!qty || qty <= 0) throw new Error("Informe uma quantidade válida.");
      const product = products.find((p) => p.id === form.product_id);
      if (!product) throw new Error("Selecione um produto.");

      const { error } = await supabase.from("movements").insert({
        product_id: form.product_id,
        type: form.type,
        quantity: qty,
        date: form.date,
        notes: form.notes.trim() || null,
      });
      if (error) throw error;

      const newStock =
        Number(product.stock) + (form.type === "entrada" ? qty : -qty);
      const { error: stockError } = await supabase
        .from("products")
        .update({ stock: newStock })
        .eq("id", product.id);
      if (stockError) throw stockError;
    },
    onSuccess: () => {
      toast.success("Movimentação registrada!");
      setModalOpen(false);
      setForm(EMPTY);
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (movement: (typeof movements)[number]) => {
      const { error } = await supabase.from("movements").delete().eq("id", movement.id);
      if (error) throw error;
      // Reverse the stock effect
      const product = products.find((p) => p.id === movement.product_id);
      if (product) {
        const qty = Number(movement.quantity);
        const newStock =
          Number(product.stock) + (movement.type === "entrada" ? -qty : qty);
        await supabase.from("products").update({ stock: newStock }).eq("id", product.id);
      }
    },
    onSuccess: () => {
      toast.success("Movimentação removida e estoque ajustado.");
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold lg:text-3xl">Entradas e Saídas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Movimentações de estoque dos produtos
          </p>
        </div>
        <button
          onClick={() => {
            setForm(EMPTY);
            setModalOpen(true);
          }}
          className="btn-gold"
          disabled={products.length === 0}
        >
          <Plus className="h-4 w-4" /> Nova movimentação
        </button>
      </div>

      {products.length === 0 && (
        <p className="mt-6 rounded-lg bg-accent px-4 py-3 text-sm text-accent-foreground">
          Cadastre produtos primeiro para registrar entradas e saídas.
        </p>
      )}

      {movements.length > 0 ? (
        <div className="mt-6 overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Produto</th>
                <th className="px-4 py-3 text-right">Quantidade</th>
                <th className="px-4 py-3">Observações</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {movements.map((m) => (
                <tr key={m.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3">{formatDate(m.date)}</td>
                  <td className="px-4 py-3">
                    {m.type === "entrada" ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-xs font-semibold text-success">
                        <ArrowDownCircle className="h-3.5 w-3.5" /> Entrada
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-semibold text-destructive">
                        <ArrowUpCircle className="h-3.5 w-3.5" /> Saída
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-medium">{m.products?.name}</td>
                  <td className="px-4 py-3 text-right font-semibold">
                    {formatQty(Number(m.quantity))} {m.products?.unit}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{m.notes ?? "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => {
                        if (confirm("Remover esta movimentação? O estoque será ajustado."))
                          deleteMutation.mutate(m);
                      }}
                      className="rounded-md p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      aria-label="Remover movimentação"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        products.length > 0 && (
          <p className="mt-10 text-center text-sm text-muted-foreground">
            Nenhuma movimentação registrada ainda.
          </p>
        )
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Nova movimentação">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            addMutation.mutate();
          }}
          className="space-y-3"
        >
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setForm({ ...form, type: "entrada" })}
              className={`rounded-md border px-3 py-2 text-sm font-semibold transition-colors ${
                form.type === "entrada"
                  ? "border-success bg-success/15 text-success"
                  : "border-border bg-card text-muted-foreground"
              }`}
            >
              Entrada
            </button>
            <button
              type="button"
              onClick={() => setForm({ ...form, type: "saida" })}
              className={`rounded-md border px-3 py-2 text-sm font-semibold transition-colors ${
                form.type === "saida"
                  ? "border-destructive bg-destructive/10 text-destructive"
                  : "border-border bg-card text-muted-foreground"
              }`}
            >
              Saída
            </button>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted-foreground">Produto *</label>
            <select
              required
              className="input-farm"
              value={form.product_id}
              onChange={(e) => setForm({ ...form, product_id: e.target.value })}
            >
              <option value="">Selecione...</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({formatQty(Number(p.stock))} {p.unit})
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-muted-foreground">Quantidade *</label>
              <input
                type="number"
                step="0.001"
                min="0.001"
                required
                className="input-farm"
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: e.target.value })}
              />
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
          <button type="submit" disabled={addMutation.isPending} className="btn-primary w-full justify-center">
            {addMutation.isPending ? "Registrando..." : "Registrar"}
          </button>
        </form>
      </Modal>
    </div>
  );
}
