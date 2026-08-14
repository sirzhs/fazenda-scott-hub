import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { AppLayout } from "@/components/farm/AppLayout";
import { Modal } from "@/components/farm/Modal";
import { ExportButtons } from "@/components/farm/ExportButtons";
import { formatBRL, formatQty, formatDate } from "@/lib/farm";

export const Route = createFileRoute("/vendas")({
  head: () => ({ meta: [{ title: "Vendas — Fazenda Scott" }] }),
  component: () => (
    <AppLayout>
      <SalesPage />
    </AppLayout>
  ),
});

const EMPTY = {
  product_id: "",
  customer: "",
  quantity: "",
  unit_price: "",
  date: new Date().toISOString().slice(0, 10),
  notes: "",
};

function SalesPage() {
  const { userId } = useAuth();
  const qc = useQueryClient();
  const reportRef = useRef<HTMLDivElement>(null);
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

  const { data: sales = [] } = useQuery({
    queryKey: ["sales", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales")
        .select("*, products(name, unit)")
        .order("date", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const total = sales.reduce((sum, s) => sum + Number(s.total), 0);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["sales"] });
    qc.invalidateQueries({ queryKey: ["products"] });
  };

  const addMutation = useMutation({
    mutationFn: async () => {
      const qty = Number(form.quantity);
      const price = Number(form.unit_price);
      if (!qty || qty <= 0) throw new Error("Informe uma quantidade válida.");
      const product = products.find((p) => p.id === form.product_id);
      if (!product) throw new Error("Selecione um produto.");

      const { error } = await supabase.from("sales").insert({
        product_id: form.product_id,
        customer: form.customer.trim() || null,
        quantity: qty,
        unit_price: price,
        total: qty * price,
        date: form.date,
        notes: form.notes.trim() || null,
      });
      if (error) throw error;

      const { error: stockError } = await supabase
        .from("products")
        .update({ stock: Number(product.stock) - qty })
        .eq("id", product.id);
      if (stockError) throw stockError;
    },
    onSuccess: () => {
      toast.success("Venda registrada!");
      setModalOpen(false);
      setForm(EMPTY);
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (sale: (typeof sales)[number]) => {
      const { error } = await supabase.from("sales").delete().eq("id", sale.id);
      if (error) throw error;
      const product = products.find((p) => p.id === sale.product_id);
      if (product) {
        await supabase
          .from("products")
          .update({ stock: Number(product.stock) + Number(sale.quantity) })
          .eq("id", product.id);
      }
    },
    onSuccess: () => {
      toast.success("Venda removida e estoque devolvido.");
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const selectedProduct = products.find((p) => p.id === form.product_id);

  return (
    <div className="page-enter mx-auto max-w-5xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold lg:text-3xl">Vendas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Total vendido: <span className="font-bold text-success">{formatBRL(total)}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
        <ExportButtons
          targetRef={reportRef}
          report={() => ({
            title: "Vendas",
            columns: [
              { header: "Data" },
              { header: "Produto" },
              { header: "Cliente" },
              { header: "Quantidade", align: "right" },
              { header: "Preço unit.", align: "right" },
              { header: "Total", align: "right" },
            ],
            rows: sales.map((s) => [
              formatDate(s.date),
              s.products?.name ?? "",
              s.customer ?? "—",
              `${formatQty(Number(s.quantity))} ${s.products?.unit ?? ""}`,
              formatBRL(Number(s.unit_price)),
              formatBRL(Number(s.total)),
            ]),
            summary: [`Total vendido: ${formatBRL(total)}`],
          })}
        />

          <button
            onClick={() => {
              setForm(EMPTY);
              setModalOpen(true);
            }}
            className="btn-gold hover-lift"
            disabled={products.length === 0}
          >
            <Plus className="h-4 w-4" /> Nova venda
          </button>
        </div>
      </div>

      {products.length === 0 && (
        <p className="mt-6 rounded-lg bg-accent px-4 py-3 text-sm text-accent-foreground">
          Cadastre produtos primeiro para registrar vendas.
        </p>
      )}

      {sales.length > 0 ? (
        <div ref={reportRef} className="mt-6 overflow-x-auto card-farm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Produto</th>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3 text-right">Qtd.</th>
                <th className="px-4 py-3 text-right">Preço un.</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sales.map((s) => (
                <tr key={s.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3">{formatDate(s.date)}</td>
                  <td className="px-4 py-3 font-medium">{s.products?.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{s.customer ?? "—"}</td>
                  <td className="px-4 py-3 text-right">
                    {formatQty(Number(s.quantity))} {s.products?.unit}
                  </td>
                  <td className="px-4 py-3 text-right">{formatBRL(Number(s.unit_price))}</td>
                  <td className="px-4 py-3 text-right font-semibold text-success">
                    {formatBRL(Number(s.total))}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => {
                        if (confirm("Remover esta venda? O estoque será devolvido."))
                          deleteMutation.mutate(s);
                      }}
                      className="rounded-md p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      aria-label="Remover venda"
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
            Nenhuma venda registrada ainda.
          </p>
        )
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Nova venda">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            addMutation.mutate();
          }}
          className="space-y-3"
        >
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted-foreground">Produto *</label>
            <select
              required
              className="input-farm"
              value={form.product_id}
              onChange={(e) => {
                const p = products.find((pr) => pr.id === e.target.value);
                setForm({
                  ...form,
                  product_id: e.target.value,
                  unit_price: p && Number(p.price) > 0 ? String(p.price) : form.unit_price,
                });
              }}
            >
              <option value="">Selecione...</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({formatQty(Number(p.stock))} {p.unit})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted-foreground">Cliente</label>
            <input
              className="input-farm"
              value={form.customer}
              onChange={(e) => setForm({ ...form, customer: e.target.value })}
              placeholder="Opcional"
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-muted-foreground">Qtd. *</label>
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
              <label className="mb-1 block text-xs font-semibold text-muted-foreground">Preço (R$) *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                className="input-farm"
                value={form.unit_price}
                onChange={(e) => setForm({ ...form, unit_price: e.target.value })}
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
          {form.quantity && form.unit_price && (
            <p className="rounded-md bg-accent px-3 py-2 text-sm font-semibold text-accent-foreground">
              Total: {formatBRL(Number(form.quantity) * Number(form.unit_price))}
              {selectedProduct ? ` · ${form.quantity} ${selectedProduct.unit}` : ""}
            </p>
          )}
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
            {addMutation.isPending ? "Registrando..." : "Registrar venda"}
          </button>
        </form>
      </Modal>
    </div>
  );
}
