import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Pencil, Trash2, Sprout } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { AppLayout } from "@/components/farm/AppLayout";
import { Modal } from "@/components/farm/Modal";
import { formatBRL, formatQty, DEFAULT_PRODUCTS } from "@/lib/farm";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/produtos")({
  head: () => ({ meta: [{ title: "Produtos — Fazenda Scott" }] }),
  component: () => (
    <AppLayout>
      <ProductsPage />
    </AppLayout>
  ),
});

type Product = Tables<"products">;

const EMPTY = { name: "", category: "", unit: "un", price: "", stock: "" };

function ProductsPage() {
  const { userId } = useAuth();
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState(EMPTY);

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["products", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["products"] });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name.trim(),
        category: form.category.trim() || null,
        unit: form.unit.trim() || "un",
        price: Number(form.price) || 0,
        stock: Number(form.stock) || 0,
      };
      if (editing) {
        const { error } = await supabase.from("products").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("products").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Produto atualizado!" : "Produto cadastrado!");
      setModalOpen(false);
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Produto removido.");
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const seedMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("products").insert(
        DEFAULT_PRODUCTS.map((p) => ({ ...p, stock: 0 })),
      );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Produtos da fazenda adicionados!");
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const openNew = () => {
    setEditing(null);
    setForm(EMPTY);
    setModalOpen(true);
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    setForm({
      name: p.name,
      category: p.category ?? "",
      unit: p.unit,
      price: String(p.price),
      stock: String(p.stock),
    });
    setModalOpen(true);
  };

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold lg:text-3xl">Produtos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Catálogo e estoque da Fazenda Scott
          </p>
        </div>
        <button onClick={openNew} className="btn-gold">
          <Plus className="h-4 w-4" /> Novo produto
        </button>
      </div>

      {!isLoading && products.length === 0 && (
        <div className="mt-10 rounded-xl border border-dashed border-border bg-card p-8 text-center">
          <Sprout className="mx-auto h-10 w-10 text-gold" />
          <p className="mt-3 font-semibold">Comece com os produtos da fazenda</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Álcool, amido, arroz curado, carnes, polpas e uva — adicione tudo com um clique.
          </p>
          <button
            onClick={() => seedMutation.mutate()}
            disabled={seedMutation.isPending}
            className="btn-primary mt-4"
          >
            Adicionar produtos padrão
          </button>
        </div>
      )}

      {products.length > 0 && (
        <div className="mt-6 overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3">Produto</th>
                <th className="px-4 py-3">Categoria</th>
                <th className="px-4 py-3 text-right">Preço</th>
                <th className="px-4 py-3 text-right">Estoque</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {products.map((p) => (
                <tr key={p.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">{p.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{p.category ?? "—"}</td>
                  <td className="px-4 py-3 text-right">
                    {formatBRL(Number(p.price))}/{p.unit}
                  </td>
                  <td
                    className={`px-4 py-3 text-right font-semibold ${
                      Number(p.stock) <= 0 ? "text-destructive" : ""
                    }`}
                  >
                    {formatQty(Number(p.stock))} {p.unit}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => openEdit(p)}
                        className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                        aria-label={`Editar ${p.name}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Remover "${p.name}"? Movimentações e vendas dele também serão removidas.`))
                            deleteMutation.mutate(p.id);
                        }}
                        className="rounded-md p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        aria-label={`Remover ${p.name}`}
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
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Editar produto" : "Novo produto"}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            saveMutation.mutate();
          }}
          className="space-y-3"
        >
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted-foreground">Nome *</label>
            <input
              required
              className="input-farm"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted-foreground">Categoria</label>
            <input
              className="input-farm"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              placeholder="Ex.: Carnes, Polpas..."
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-muted-foreground">Unidade</label>
              <input
                className="input-farm"
                value={form.unit}
                onChange={(e) => setForm({ ...form, unit: e.target.value })}
                placeholder="kg, L, un"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-muted-foreground">Preço (R$)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="input-farm"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-muted-foreground">Estoque</label>
              <input
                type="number"
                step="0.001"
                className="input-farm"
                value={form.stock}
                onChange={(e) => setForm({ ...form, stock: e.target.value })}
              />
            </div>
          </div>
          <button type="submit" disabled={saveMutation.isPending} className="btn-primary w-full justify-center">
            {saveMutation.isPending ? "Salvando..." : "Salvar"}
          </button>
        </form>
      </Modal>
    </div>
  );
}
