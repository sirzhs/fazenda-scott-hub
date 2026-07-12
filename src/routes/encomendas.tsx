import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { AppLayout } from "@/components/farm/AppLayout";
import { Modal } from "@/components/farm/Modal";
import { formatQty, formatDate, ORDER_STATUS } from "@/lib/farm";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/encomendas")({
  head: () => ({ meta: [{ title: "Encomendas — Fazenda Scott" }] }),
  component: () => (
    <AppLayout>
      <OrdersPage />
    </AppLayout>
  ),
});

type Order = Tables<"orders">;

const EMPTY = {
  product_id: "",
  customer: "",
  quantity: "",
  status: "pendente",
  due_date: "",
  notes: "",
};

function OrdersPage() {
  const { userId } = useAuth();
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Order | null>(null);
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

  const { data: orders = [] } = useQuery({
    queryKey: ["orders", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, products(name, unit)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["orders"] });
    qc.invalidateQueries({ queryKey: ["orders-pending"] });
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const qty = Number(form.quantity);
      if (!qty || qty <= 0) throw new Error("Informe uma quantidade válida.");
      const payload = {
        product_id: form.product_id,
        customer: form.customer.trim(),
        quantity: qty,
        status: form.status,
        due_date: form.due_date || null,
        notes: form.notes.trim() || null,
      };
      if (editing) {
        const { error } = await supabase.from("orders").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("orders").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Encomenda atualizada!" : "Encomenda registrada!");
      setModalOpen(false);
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("orders").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Encomenda removida.");
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const openEdit = (o: Order) => {
    setEditing(o);
    setForm({
      product_id: o.product_id,
      customer: o.customer,
      quantity: String(o.quantity),
      status: o.status,
      due_date: o.due_date ?? "",
      notes: o.notes ?? "",
    });
    setModalOpen(true);
  };

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold lg:text-3xl">Encomendas</h1>
          <p className="mt-1 text-sm text-muted-foreground">Pedidos de clientes da fazenda</p>
        </div>
        <button
          onClick={() => {
            setEditing(null);
            setForm(EMPTY);
            setModalOpen(true);
          }}
          className="btn-gold"
          disabled={products.length === 0}
        >
          <Plus className="h-4 w-4" /> Nova encomenda
        </button>
      </div>

      {products.length === 0 && (
        <p className="mt-6 rounded-lg bg-accent px-4 py-3 text-sm text-accent-foreground">
          Cadastre produtos primeiro para registrar encomendas.
        </p>
      )}

      {orders.length > 0 ? (
        <div className="mt-6 overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Produto</th>
                <th className="px-4 py-3 text-right">Qtd.</th>
                <th className="px-4 py-3">Entrega</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {orders.map((o) => {
                const status = ORDER_STATUS[o.status] ?? ORDER_STATUS.pendente;
                return (
                  <tr key={o.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">{o.customer}</td>
                    <td className="px-4 py-3">{o.products?.name}</td>
                    <td className="px-4 py-3 text-right">
                      {formatQty(Number(o.quantity))} {o.products?.unit}
                    </td>
                    <td className="px-4 py-3">{formatDate(o.due_date)}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${status.className}`}>
                        {status.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => openEdit(o)}
                          className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                          aria-label="Editar encomenda"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm("Remover esta encomenda?")) deleteMutation.mutate(o.id);
                          }}
                          className="rounded-md p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          aria-label="Remover encomenda"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        products.length > 0 && (
          <p className="mt-10 text-center text-sm text-muted-foreground">
            Nenhuma encomenda registrada ainda.
          </p>
        )
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Editar encomenda" : "Nova encomenda"}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            saveMutation.mutate();
          }}
          className="space-y-3"
        >
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted-foreground">Cliente *</label>
            <input
              required
              className="input-farm"
              value={form.customer}
              onChange={(e) => setForm({ ...form, customer: e.target.value })}
            />
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
                  {p.name}
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
              <label className="mb-1 block text-xs font-semibold text-muted-foreground">Data de entrega</label>
              <input
                type="date"
                className="input-farm"
                value={form.due_date}
                onChange={(e) => setForm({ ...form, due_date: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted-foreground">Status</label>
            <select
              className="input-farm"
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
            >
              <option value="pendente">Pendente</option>
              <option value="em_producao">Em produção</option>
              <option value="entregue">Entregue</option>
              <option value="cancelada">Cancelada</option>
            </select>
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
