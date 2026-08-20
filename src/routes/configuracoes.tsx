import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  Webhook,
  Save,
  Send,
  ClipboardPaste,
  CheckCircle2,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { AppLayout } from "@/components/farm/AppLayout";
import { testDiscordWebhook } from "@/lib/discord.functions";
import {
  LOG_KIND_LABEL,
  matchProduct,
  parseLogBlock,
  type ParsedLog,
} from "@/lib/discord-log";
import { formatBRL, formatQty, todayISO } from "@/lib/farm";

export const Route = createFileRoute("/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações e Discord — Fazenda Scott" },
      {
        name: "description",
        content:
          "Configure o webhook do Discord da Fazenda Scott e importe as logs do baú, loja e cofre sem duplicar registros.",
      },
      { property: "og:title", content: "Configurações e Discord — Fazenda Scott" },
      {
        property: "og:description",
        content:
          "Webhook do Discord e importação manual das logs de movimentação da Fazenda Scott.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <AppLayout>
      <SettingsPage />
    </AppLayout>
  ),
});

function SettingsPage() {
  const { userId } = useAuth();
  const qc = useQueryClient();
  const [url, setUrl] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [logText, setLogText] = useState("");
  const [skipped, setSkipped] = useState<Set<string>>(new Set());

  useQuery({
    queryKey: ["app-settings", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("*")
        .eq("user_id", userId!)
        .maybeSingle();
      if (error) throw error;
      if (data && !dirty) {
        setUrl(data.discord_webhook_url ?? "");
        setEnabled(data.notify_enabled);
      }
      return data;
    },
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

  const parsed = useMemo(() => parseLogBlock(logText), [logText]);
  const hashes = parsed.parsed.map((p) => p.hash);

  const { data: alreadyImported = [] } = useQuery({
    queryKey: ["discord-imports", userId, hashes.join(",")],
    enabled: !!userId && hashes.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("discord_imports")
        .select("line_hash")
        .in("line_hash", hashes);
      if (error) throw error;
      return data.map((r) => r.line_hash);
    },
  });

  const importedSet = new Set(alreadyImported);
  const pending = parsed.parsed.filter((p) => !importedSet.has(p.hash) && !skipped.has(p.hash));

  const saveSettings = useMutation({
    mutationFn: async () => {
      const clean = url.trim();
      if (clean && !/^https:\/\/(?:\w+\.)?discord(?:app)?\.com\/api\/webhooks\//.test(clean)) {
        throw new Error("Cole a URL completa do webhook do Discord.");
      }
      const { error } = await supabase.from("app_settings").upsert(
        { user_id: userId!, discord_webhook_url: clean || null, notify_enabled: enabled },
        { onConflict: "user_id" },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      setDirty(false);
      toast.success("Configurações salvas!");
      qc.invalidateQueries({ queryKey: ["app-settings"] });
    },
    onError: (e) => toast.error(e.message),
  });

  const testWebhook = useMutation({
    mutationFn: async () => testDiscordWebhook({ data: { url: url.trim() } }),
    onSuccess: () => toast.success("Mensagem de teste enviada ao Discord!"),
    onError: (e) => toast.error(e.message),
  });

  const importLogs = useMutation({
    mutationFn: async () => {
      if (!pending.length) throw new Error("Nada novo para importar.");
      let applied = 0;
      let ignored = 0;

      for (const log of pending) {
        const result = await applyLog(log, products, userId!);
        if (result === "ignored") {
          ignored += 1;
          continue;
        }
        applied += 1;
      }
      return { applied, ignored };
    },
    onSuccess: ({ applied, ignored }) => {
      toast.success(
        `${applied} log(s) importada(s)${ignored ? ` · ${ignored} sem produto correspondente` : ""}.`,
      );
      setLogText("");
      setSkipped(new Set());
      qc.invalidateQueries();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="page-enter mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold lg:text-3xl">Configurações</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Webhook do Discord e importação das logs do servidor
        </p>
      </div>

      <section className="card-farm p-5">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <Webhook className="h-5 w-5 text-primary" /> Webhook do Discord
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Cada registro criado, editado ou removido no app é enviado para este canal.
        </p>
        <div className="mt-4 space-y-3">
          <input
            className="input-farm"
            placeholder="https://discord.com/api/webhooks/..."
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setDirty(true);
            }}
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => {
                setEnabled(e.target.checked);
                setDirty(true);
              }}
            />
            Enviar notificações automáticas
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => saveSettings.mutate()}
              disabled={saveSettings.isPending}
              className="btn-primary hover-lift"
            >
              <Save className="h-4 w-4" /> {saveSettings.isPending ? "Salvando..." : "Salvar"}
            </button>
            <button
              onClick={() => testWebhook.mutate()}
              disabled={!url.trim() || testWebhook.isPending}
              className="btn-outline hover-lift"
            >
              <Send className="h-4 w-4" /> {testWebhook.isPending ? "Enviando..." : "Testar"}
            </button>
          </div>
        </div>
      </section>

      <section className="card-farm p-5">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <ClipboardPaste className="h-5 w-5 text-primary" /> Importar logs do Discord
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Cole as linhas do canal de logs (baú, loja, cofre). Linhas já importadas são ignoradas
          automaticamente — nada é registrado duas vezes.
        </p>
        <textarea
          className="input-farm mt-4 min-h-40 font-mono text-xs"
          placeholder={"[19/08/2026 14:32] Jefnho depositou 30x Polpa de Uva no baú\nJefnho vendeu 5x Bisteca por R$250,00 na loja"}
          value={logText}
          onChange={(e) => setLogText(e.target.value)}
        />

        {parsed.total > 0 && (
          <div className="mt-4 space-y-2">
            <p className="text-xs text-muted-foreground">
              {parsed.total} linha(s) · {parsed.parsed.length} reconhecida(s) ·{" "}
              {importedSet.size} já importada(s) · {parsed.ignored.length} ignorada(s)
            </p>
            <div className="max-h-80 space-y-2 overflow-y-auto">
              {parsed.parsed.map((log) => {
                const done = importedSet.has(log.hash);
                const product = matchProduct(products, log.item);
                const off = skipped.has(log.hash);
                return (
                  <div
                    key={log.hash}
                    className={`rounded-lg border px-3 py-2 text-sm ${
                      done ? "border-border bg-muted/40 opacity-70" : "border-border bg-card"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold">{LOG_KIND_LABEL[log.kind]}</p>
                        <p className="truncate text-xs text-muted-foreground">{log.raw}</p>
                        <p className="mt-1 text-xs">
                          {log.quantity != null && <>Qtd: {formatQty(log.quantity)} · </>}
                          {log.amount != null && <>Valor: {formatBRL(log.amount)} · </>}
                          {log.item ? (
                            product ? (
                              <span className="text-success">Produto: {product.name}</span>
                            ) : (
                              <span className="text-destructive">
                                Produto "{log.item}" não cadastrado
                              </span>
                            )
                          ) : null}
                        </p>
                      </div>
                      {done ? (
                        <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-success">
                          <CheckCircle2 className="h-4 w-4" /> Importada
                        </span>
                      ) : (
                        <label className="flex shrink-0 items-center gap-1 text-xs">
                          <input
                            type="checkbox"
                            checked={!off}
                            onChange={(e) => {
                              const next = new Set(skipped);
                              if (e.target.checked) next.delete(log.hash);
                              else next.add(log.hash);
                              setSkipped(next);
                            }}
                          />
                          importar
                        </label>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {parsed.ignored.length > 0 && (
              <details className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs">
                <summary className="flex cursor-pointer items-center gap-1 font-semibold">
                  <AlertTriangle className="h-3.5 w-3.5" /> Linhas não reconhecidas (
                  {parsed.ignored.length})
                </summary>
                <ul className="mt-2 space-y-1 text-muted-foreground">
                  {parsed.ignored.slice(0, 30).map((line, i) => (
                    <li key={i} className="truncate">
                      {line}
                    </li>
                  ))}
                </ul>
              </details>
            )}

            <button
              onClick={() => importLogs.mutate()}
              disabled={!pending.length || importLogs.isPending}
              className="btn-gold hover-lift"
            >
              {importLogs.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ClipboardPaste className="h-4 w-4" />
              )}
              {importLogs.isPending
                ? "Importando..."
                : `Importar ${pending.length} log(s) nova(s)`}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

type Product = { id: string; name: string; unit: string; price: number; stock: number };

/** Cria o registro correspondente à log e grava o hash para não repetir. */
async function applyLog(
  log: ParsedLog,
  products: Product[],
  userId: string,
): Promise<"applied" | "ignored"> {
  const date = log.date ?? todayISO();
  const product = matchProduct(products, log.item);
  let targetTable: string | null = null;
  let targetId: string | null = null;

  if (log.kind === "estoque_entrada" || log.kind === "estoque_saida") {
    if (!product || !log.quantity) return "ignored";
    const type = log.kind === "estoque_entrada" ? "entrada" : "saida";
    const { data, error } = await supabase
      .from("movements")
      .insert({
        product_id: product.id,
        type,
        quantity: log.quantity,
        date,
        notes: `Discord${log.actor ? ` · ${log.actor}` : ""}`,
      })
      .select("id")
      .single();
    if (error) throw error;
    const delta = type === "entrada" ? log.quantity : -log.quantity;
    await supabase
      .from("products")
      .update({ stock: Number(product.stock) + delta })
      .eq("id", product.id);
    product.stock = Number(product.stock) + delta;
    targetTable = "movements";
    targetId = data.id;
  } else if (log.kind === "venda") {
    if (!product || !log.quantity) return "ignored";
    const unitPrice = log.amount ? log.amount / log.quantity : Number(product.price);
    const { data, error } = await supabase
      .from("sales")
      .insert({
        product_id: product.id,
        customer: log.actor,
        quantity: log.quantity,
        unit_price: unitPrice,
        total: log.amount ?? unitPrice * log.quantity,
        date,
        notes: "Importado do Discord",
      })
      .select("id")
      .single();
    if (error) throw error;
    await supabase
      .from("products")
      .update({ stock: Number(product.stock) - log.quantity })
      .eq("id", product.id);
    product.stock = Number(product.stock) - log.quantity;
    targetTable = "sales";
    targetId = data.id;
  } else if (log.kind === "gasto") {
    if (!log.amount) return "ignored";
    const { data, error } = await supabase
      .from("expenses")
      .insert({
        description: log.item ? `Discord: ${log.item}` : "Gasto importado do Discord",
        category: "materia_prima",
        amount: log.amount,
        date,
        notes: log.raw,
      })
      .select("id")
      .single();
    if (error) throw error;
    targetTable = "expenses";
    targetId = data.id;
  } else {
    if (!log.amount) return "ignored";
    const { data, error } = await supabase
      .from("finance_entries")
      .insert({
        kind: log.kind === "dinheiro_entrada" ? "receber" : "pagar",
        party: log.actor ?? "Discord",
        description: log.kind === "dinheiro_entrada" ? "Depósito no cofre" : "Retirada do cofre",
        amount: log.amount,
        due_date: date,
        paid_at: date,
        notes: log.raw,
      })
      .select("id")
      .single();
    if (error) throw error;
    targetTable = "finance_entries";
    targetId = data.id;
  }

  const { error: logError } = await supabase.from("discord_imports").insert({
    user_id: userId,
    line_hash: log.hash,
    raw_line: log.raw,
    kind: log.kind,
    actor: log.actor,
    item: log.item,
    quantity: log.quantity,
    amount: log.amount,
    logged_at: log.loggedAt,
    target_table: targetTable,
    target_id: targetId,
  });
  if (logError) throw logError;

  return "applied";
}
