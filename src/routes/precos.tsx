import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useRef, useState } from "react";
import { ExternalLink, RefreshCw, Search, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { AppLayout } from "@/components/farm/AppLayout";
import { ExportButtons } from "@/components/farm/ExportButtons";
import { fetchPriceSheet, PRICE_SHEET_URL } from "@/lib/price-sheet.functions";
import { formatBRL } from "@/lib/farm";

export const Route = createFileRoute("/precos")({
  head: () => ({
    meta: [
      { title: "Tabela de Preços — Fazenda Scott" },
      {
        name: "description",
        content:
          "Tabela de preços mínimos e máximos sincronizada diariamente com a planilha oficial da Fazenda Scott.",
      },
      { property: "og:title", content: "Tabela de Preços — Fazenda Scott" },
      {
        property: "og:description",
        content: "Preços de referência atualizados automaticamente a partir da planilha oficial.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <AppLayout>
      <PricesPage />
    </AppLayout>
  ),
});

function normalize(v: string) {
  return v
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function PricesPage() {
  const { userId } = useAuth();
  const qc = useQueryClient();
  const loadSheet = useServerFn(fetchPriceSheet);
  const [term, setTerm] = useState("");
  const reportRef = useRef<HTMLDivElement>(null);

  const { data, isFetching, refetch, error } = useQuery({
    queryKey: ["price-sheet"],
    queryFn: () => loadSheet(),
    // A planilha muda no máximo uma vez por dia: revalida a cada 6 horas.
    staleTime: 1000 * 60 * 60 * 6,
    refetchInterval: 1000 * 60 * 60 * 6,
    refetchOnWindowFocus: true,
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const items = data?.items ?? [];
  const filtered = useMemo(() => {
    const t = normalize(term);
    return t ? items.filter((i) => normalize(i.name).includes(t)) : items;
  }, [items, term]);

  const productByName = useMemo(
    () => new Map(products.map((p) => [normalize(p.name), p])),
    [products],
  );

  const applyMutation = useMutation({
    mutationFn: async ({ name, price }: { name: string; price: number }) => {
      const product = productByName.get(normalize(name));
      if (!product) throw new Error("Produto não cadastrado.");
      const { error } = await supabase.from("products").update({ price }).eq("id", product.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Preço aplicado ao produto!");
      qc.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (e) => toast.error(e.message),
  });

  const syncAll = useMutation({
    mutationFn: async () => {
      const updates = items
        .map((i) => ({ product: productByName.get(normalize(i.name)), price: i.max }))
        .filter((u): u is { product: (typeof products)[number]; price: number } => !!u.product);
      if (!updates.length) throw new Error("Nenhum produto cadastrado corresponde à planilha.");
      for (const u of updates) {
        const { error } = await supabase
          .from("products")
          .update({ price: u.price })
          .eq("id", u.product.id);
        if (error) throw error;
      }
      return updates.length;
    },
    onSuccess: (count) => {
      toast.success(`${count} produto(s) atualizados com o preço máximo da planilha.`);
      qc.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="page-enter mx-auto max-w-5xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold lg:text-3xl">Tabela de Preços</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Sincronizada com a planilha oficial
            {data?.updatedAt ? ` · Atualizada em ${data.updatedAt}` : ""}
            {data?.fetchedAt
              ? ` · Lida às ${new Date(data.fetchedAt).toLocaleTimeString("pt-BR")}`
              : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a href={PRICE_SHEET_URL} target="_blank" rel="noreferrer" className="btn-outline hover-lift">
            <ExternalLink className="h-4 w-4" /> Planilha
          </a>
          <button onClick={() => refetch()} disabled={isFetching} className="btn-primary hover-lift">
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            {isFetching ? "Atualizando" : "Atualizar"}
          </button>
          <ExportButtons
            targetRef={reportRef}
            report={() => ({
              title: "Tabela de Precos",
              subtitle: data?.updatedAt ? `Planilha de ${data.updatedAt}` : undefined,
              columns: [
                { header: "Produto" },
                { header: "Mínimo", align: "right" },
                { header: "Máximo", align: "right" },
              ],
              rows: filtered.map((i) => [i.name, formatBRL(i.min), formatBRL(i.max)]),
              summary: [`${filtered.length} itens listados`],
            })}
          />
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-56">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            className="input-farm pl-9"
            placeholder="Buscar produto..."
            value={term}
            onChange={(e) => setTerm(e.target.value)}
          />
        </div>
        <button
          onClick={() => syncAll.mutate()}
          disabled={syncAll.isPending || !items.length}
          className="btn-gold hover-lift"
        >
          <Wand2 className="h-4 w-4" />
          {syncAll.isPending ? "Sincronizando..." : "Aplicar preços aos produtos"}
        </button>
      </div>

      {error ? (
        <p className="mt-8 rounded-lg bg-destructive/10 px-4 py-3 text-sm font-semibold text-destructive">
          Não foi possível carregar a planilha agora. Tente atualizar novamente.
        </p>
      ) : (
        <div ref={reportRef} className="card-farm mt-6 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3">Produto</th>
                <th className="px-4 py-3 text-right">Mínimo</th>
                <th className="px-4 py-3 text-right">Máximo</th>
                <th className="px-4 py-3 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((i) => {
                const linked = productByName.get(normalize(i.name));
                return (
                  <tr key={i.name} className="transition-colors hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">
                      {i.name}
                      {linked && (
                        <span className="ml-2 rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-bold uppercase text-success">
                          cadastrado
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">{formatBRL(i.min)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-gold-foreground">
                      {formatBRL(i.max)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {linked ? (
                        <button
                          onClick={() => applyMutation.mutate({ name: i.name, price: i.max })}
                          className="text-xs font-semibold text-primary hover:underline"
                        >
                          Usar máximo
                        </button>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!filtered.length && !isFetching && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    Nenhum item encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
