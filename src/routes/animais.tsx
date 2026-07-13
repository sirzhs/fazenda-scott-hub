import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Pencil, Trash2, Beef, ShoppingBag, Scissors } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { AppLayout } from "@/components/farm/AppLayout";
import { Modal } from "@/components/farm/Modal";
import {
  ANIMAL_CATEGORIES,
  animalCategoryLabel,
  formatBRL,
  formatQty,
} from "@/lib/farm";

export const Route = createFileRoute("/animais")({
  head: () => ({ meta: [{ title: "Animais — Fazenda Scott" }] }),
  component: () => (
    <AppLayout>
      <AnimalsPage />
    </AppLayout>
  ),
});

type AnimalRow = {
  id: string;
  name: string;
  category: string;
  purchased: number;
  slaughtered: number;
  unit_value: number;
  notes: string | null;
};

const EMPTY = {
  id: "",
  name: "",
  category: "gados",
  purchased: "0",
  slaughtered: "0",
  unit_value: "0",
  notes: "",
};

function AnimalsPage() {
  const { userId } = useAuth();
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [adjust, setAdjust] = useState<{
    animal: AnimalRow;
    type: "compra" | "abate";
    quantity: string;
  } | null>(null);

  const { data: animals = [] } = useQuery({
    queryKey: ["animals", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("animals")
        .select("*")
        .order("category")
        .order("name");
      if (error) throw error;
      return data as AnimalRow[];
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["animals"] });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error("Informe o nome.");
      const payload = {
        name: form.name.trim(),
        category: form.category,
        purchased: Number(form.purchased) || 0,
        slaughtered: Number(form.slaughtered) || 0,
        unit_value: Number(form.unit_value) || 0,
        notes: form.notes.trim() || null,
      };
      if (form.id) {
        const { error } = await supabase.from("animals").update(payload).eq("id", form.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("animals").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(form.id ? "Animal atualizado!" : "Animal cadastrado!");
      setModalOpen(false);
      setForm(EMPTY);
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("animals").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Registro removido.");
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const adjustMutation = useMutation({
    mutationFn: async () => {
      if (!adjust) return;
      const qty = Number(adjust.quantity);
      if (!qty || qty <= 0) throw new Error("Informe uma quantidade válida.");
      const field = adjust.type === "compra" ? "purchased" : "slaughtered";
      const current = Number(adjust.animal[field]);
      const { error } = await supabase
        .from("animals")
        .update({ [field]: current + qty })
        .eq("id", adjust.animal.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(adjust?.type === "compra" ? "Compra registrada!" : "Abate registrado!");
      setAdjust(null);
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const totals = animals.reduce(
    (acc, a) => {
      const alive = Math.max(Number(a.purchased) - Number(a.slaughtered), 0);
      acc.purchased += Number(a.purchased);
      acc.slaughtered += Number(a.slaughtered);
      acc.alive += alive;
      acc.value += alive * Number(a.unit_value);
      return acc;
    },
    { purchased: 0, slaughtered: 0, alive: 0, value: 0 },
  );

  const grouped = ANIMAL_CATEGORIES.map((cat) => ({
    ...cat,
    items: animals.filter((a) => a.category === cat.value),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold lg:text-3xl">Animais</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Controle de rebanho por categoria — compras e abates
          </p>
        </div>
        <button
          onClick={() => {
            setForm(EMPTY);
            setModalOpen(true);
          }}
          className="btn-gold"
        >
          <Plus className="h-4 w-4" /> Novo registro
        </button>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="Comprados" value={formatQty(totals.purchased)} />
        <SummaryCard label="Abatidos" value={formatQty(totals.slaughtered)} />
        <SummaryCard label="Rebanho atual" value={formatQty(totals.alive)} highlight />
        <SummaryCard label="Valor estimado" value={formatBRL(totals.value)} highlight />
      </div>

      {animals.length === 0 ? (
        <p className="mt-10 text-center text-sm text-muted-foreground">
          Nenhum animal cadastrado ainda. Clique em <strong>Novo registro</strong> para começar.
        </p>
      ) : (
        <div className="mt-8 space-y-6">
          {grouped.map((g) => (
            <section key={g.value} className="rounded-xl border border-border bg-card">
              <header className="flex items-center gap-2 border-b border-border px-4 py-3">
                <Beef className="h-4 w-4 text-gold" />
                <h2 className="text-base font-bold">{g.label}</h2>
              </header>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="px-4 py-2.5">Nome / Lote</th>
                      <th className="px-4 py-2.5 text-right">Comprados</th>
                      <th className="px-4 py-2.5 text-right">Abatidos</th>
                      <th className="px-4 py-2.5 text-right">Atual</th>
                      <th className="px-4 py-2.5 text-right">Valor / cabeça</th>
                      <th className="px-4 py-2.5 text-right">Total</th>
                      <th className="px-4 py-2.5 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {g.items.map((a) => {
                      const alive = Math.max(Number(a.purchased) - Number(a.slaughtered), 0);
                      return (
                        <tr key={a.id} className="hover:bg-muted/30">
                          <td className="px-4 py-3">
                            <p className="font-medium">{a.name}</p>
                            {a.notes && (
                              <p className="text-xs text-muted-foreground">{a.notes}</p>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">{formatQty(Number(a.purchased))}</td>
                          <td className="px-4 py-3 text-right">{formatQty(Number(a.slaughtered))}</td>
                          <td className="px-4 py-3 text-right font-semibold">{formatQty(alive)}</td>
                          <td className="px-4 py-3 text-right">{formatBRL(Number(a.unit_value))}</td>
                          <td className="px-4 py-3 text-right font-semibold text-success">
                            {formatBRL(alive * Number(a.unit_value))}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex justify-end gap-1">
                              <button
                                onClick={() => setAdjust({ animal: a, type: "compra", quantity: "1" })}
                                className="rounded-md p-2 text-muted-foreground hover:bg-success/15 hover:text-success"
                                aria-label="Registrar compra"
                                title="Registrar compra"
                              >
                                <ShoppingBag className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => setAdjust({ animal: a, type: "abate", quantity: "1" })}
                                className="rounded-md p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                aria-label="Registrar abate"
                                title="Registrar abate"
                              >
                                <Scissors className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => {
                                  setForm({
                                    id: a.id,
                                    name: a.name,
                                    category: a.category,
                                    purchased: String(a.purchased),
                                    slaughtered: String(a.slaughtered),
                                    unit_value: String(a.unit_value),
                                    notes: a.notes ?? "",
                                  });
                                  setModalOpen(true);
                                }}
                                className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                                aria-label="Editar"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => {
                                  if (confirm(`Remover "${a.name}"?`)) deleteMutation.mutate(a.id);
                                }}
                                className="rounded-md p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                aria-label="Remover"
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
            </section>
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={form.id ? "Editar animal" : "Novo registro"}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            saveMutation.mutate();
          }}
          className="space-y-3"
        >
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted-foreground">Nome / Lote *</label>
            <input
              required
              className="input-farm"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Ex.: Rebanho principal"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted-foreground">Categoria *</label>
            <select
              className="input-farm"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            >
              {ANIMAL_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-muted-foreground">Comprados</label>
              <input
                type="number"
                step="1"
                min="0"
                className="input-farm"
                value={form.purchased}
                onChange={(e) => setForm({ ...form, purchased: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-muted-foreground">Abatidos</label>
              <input
                type="number"
                step="1"
                min="0"
                className="input-farm"
                value={form.slaughtered}
                onChange={(e) => setForm({ ...form, slaughtered: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted-foreground">
              Valor por cabeça (R$)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              className="input-farm"
              value={form.unit_value}
              onChange={(e) => setForm({ ...form, unit_value: e.target.value })}
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

      <Modal
        open={!!adjust}
        onClose={() => setAdjust(null)}
        title={adjust?.type === "compra" ? "Registrar compra" : "Registrar abate"}
      >
        {adjust && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              adjustMutation.mutate();
            }}
            className="space-y-3"
          >
            <p className="text-sm text-muted-foreground">
              <strong className="text-foreground">{adjust.animal.name}</strong> —{" "}
              {animalCategoryLabel(adjust.animal.category)}
            </p>
            <div>
              <label className="mb-1 block text-xs font-semibold text-muted-foreground">
                Quantidade *
              </label>
              <input
                type="number"
                step="1"
                min="1"
                required
                autoFocus
                className="input-farm"
                value={adjust.quantity}
                onChange={(e) => setAdjust({ ...adjust, quantity: e.target.value })}
              />
            </div>
            <button
              type="submit"
              disabled={adjustMutation.isPending}
              className="btn-primary w-full justify-center"
            >
              {adjustMutation.isPending ? "Registrando..." : "Confirmar"}
            </button>
          </form>
        )}
      </Modal>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className={`mt-2 text-xl font-bold ${highlight ? "text-success" : "text-card-foreground"}`}>
        {value}
      </p>
    </div>
  );
}
