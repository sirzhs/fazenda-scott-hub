import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useRef } from "react";
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  Package,
  ClipboardList,
  Warehouse,
  Beef,
  Percent,
  ArrowDownCircle,
  ArrowUpCircle,
  AlertTriangle,
  Users,
  Factory,
  CalendarClock,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { AppLayout } from "@/components/farm/AppLayout";
import { ExportButtons } from "@/components/farm/ExportButtons";
import {
  formatBRL,
  formatQty,
  formatDate,
  financeStatus,
  lastMonthKeys,
  monthKey,
  monthLabel,
  startOfWeekISO,
  todayISO,
} from "@/lib/farm";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Painel da Fazenda Scott — Gestão rural" },
      {
        name: "description",
        content:
          "Painel gerencial da Fazenda Scott: faturamento, lucro, margem, contas, estoque, vendas e produção.",
      },
      { property: "og:title", content: "Painel gerencial da Fazenda Scott" },
      {
        property: "og:description",
        content:
          "Faturamento e lucro do mês, contas a pagar e receber, estoque, vendas e encomendas em um só painel.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <AppLayout>
      <Dashboard />
    </AppLayout>
  ),
});

const MIN_STOCK = 20;

function Dashboard() {
  const { userId } = useAuth();
  const reportRef = useRef<HTMLDivElement>(null);

  const { data: sales = [] } = useQuery({
    queryKey: ["sales", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales")
        .select("*, products(name, unit)")
        .order("date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: expenses = [] } = useQuery({
    queryKey: ["expenses", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.from("expenses").select("*");
      if (error) throw error;
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

  const { data: orders = [] } = useQuery({
    queryKey: ["orders", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, products(name, unit)")
        .order("due_date", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: animals = [] } = useQuery({
    queryKey: ["animals", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.from("animals").select("*").order("category");
      if (error) throw error;
      return data;
    },
  });

  const { data: finance = [] } = useQuery({
    queryKey: ["finance", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.from("finance_entries").select("*");
      if (error) throw error;
      return data;
    },
  });

  const { data: movements = [] } = useQuery({
    queryKey: ["movements", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.from("movements").select("*");
      if (error) throw error;
      return data;
    },
  });

  const m = useMemo(() => {
    const today = todayISO();
    const weekStart = startOfWeekISO();
    const thisMonth = monthKey(new Date());

    const salesTotal = sales.reduce((s, r) => s + Number(r.total), 0);
    const expensesTotal = expenses.reduce((s, r) => s + Number(r.amount), 0);
    const balance = salesTotal - expensesTotal;

    const inMonth = (date: string, key: string) => date.slice(0, 7) === key;
    const revenueMonth = sales
      .filter((s) => inMonth(s.date, thisMonth))
      .reduce((sum, s) => sum + Number(s.total), 0);
    const expensesMonth = expenses
      .filter((e) => inMonth(e.date, thisMonth))
      .reduce((sum, e) => sum + Number(e.amount), 0);
    const profitMonth = revenueMonth - expensesMonth;
    const marginMonth = revenueMonth > 0 ? (profitMonth / revenueMonth) * 100 : 0;

    const openFinance = finance.filter((e) => !e.paid_at);
    const toPay = openFinance
      .filter((e) => e.kind === "pagar")
      .reduce((s, e) => s + Number(e.amount), 0);
    const toReceive = openFinance
      .filter((e) => e.kind === "receber")
      .reduce((s, e) => s + Number(e.amount), 0);
    const lateFinance = openFinance.filter((e) => financeStatus(e) === "atrasado").length;

    // Estoque
    const outOfStock = products.filter((p) => Number(p.stock) <= 0);
    const belowMin = products.filter(
      (p) => Number(p.stock) > 0 && Number(p.stock) < MIN_STOCK,
    );
    const productsStockValue = products.reduce(
      (s, p) => s + Number(p.stock) * Number(p.price),
      0,
    );
    const animalsAlive = animals.reduce(
      (s, a) => s + Math.max(Number(a.purchased) - Number(a.slaughtered), 0),
      0,
    );
    const animalsStockValue = animals.reduce(
      (s, a) =>
        s + Math.max(Number(a.purchased) - Number(a.slaughtered), 0) * Number(a.unit_value),
      0,
    );

    // Saída por produto (vendas + movimentações de saída)
    const outByProduct = new Map<string, number>();
    for (const s of sales)
      outByProduct.set(s.product_id, (outByProduct.get(s.product_id) ?? 0) + Number(s.quantity));
    for (const mv of movements)
      if (mv.type === "saida")
        outByProduct.set(
          mv.product_id,
          (outByProduct.get(mv.product_id) ?? 0) + Number(mv.quantity),
        );

    const topOut = [...outByProduct.entries()]
      .map(([id, qty]) => ({ product: products.find((p) => p.id === id), qty }))
      .filter((r) => r.product)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);

    const idle = products.filter((p) => !outByProduct.get(p.id));

    // Vendas
    const salesToday = sales
      .filter((s) => s.date === today)
      .reduce((sum, s) => sum + Number(s.total), 0);
    const salesWeek = sales
      .filter((s) => s.date >= weekStart)
      .reduce((sum, s) => sum + Number(s.total), 0);

    const revenueByProduct = new Map<string, number>();
    for (const s of sales)
      revenueByProduct.set(
        s.product_id,
        (revenueByProduct.get(s.product_id) ?? 0) + Number(s.total),
      );
    const bestProductId = [...revenueByProduct.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    const bestProduct = products.find((p) => p.id === bestProductId);

    const byCustomer = new Map<string, number>();
    for (const s of sales) {
      const key = (s.customer ?? "").trim();
      if (!key) continue;
      byCustomer.set(key, (byCustomer.get(key) ?? 0) + Number(s.total));
    }
    const topCustomer = [...byCustomer.entries()].sort((a, b) => b[1] - a[1])[0];

    // Produção / encomendas
    const pending = orders.filter((o) => o.status === "pendente");
    const producing = orders.filter((o) => o.status === "em_producao");
    const late = orders.filter(
      (o) =>
        ["pendente", "em_producao"].includes(o.status) && o.due_date && o.due_date < today,
    );
    const upcoming = orders.filter(
      (o) =>
        ["pendente", "em_producao"].includes(o.status) && (!o.due_date || o.due_date >= today),
    );
    const plannedQty = upcoming.reduce((s, o) => s + Number(o.quantity), 0);

    // Comparativo mensal
    const monthsKeys = lastMonthKeys(3);
    const comparison = monthsKeys.map((key) => {
      const rev = sales
        .filter((s) => inMonth(s.date, key))
        .reduce((sum, s) => sum + Number(s.total), 0);
      const exp = expenses
        .filter((e) => inMonth(e.date, key))
        .reduce((sum, e) => sum + Number(e.amount), 0);
      return { key, label: monthLabel(key), rev, exp, profit: rev - exp };
    });

    return {
      salesTotal,
      expensesTotal,
      balance,
      revenueMonth,
      expensesMonth,
      profitMonth,
      marginMonth,
      toPay,
      toReceive,
      lateFinance,
      outOfStock,
      belowMin,
      productsStockValue,
      animalsAlive,
      animalsStockValue,
      totalStockValue: productsStockValue + animalsStockValue,
      topOut,
      idle,
      salesToday,
      salesWeek,
      bestProduct,
      bestProductRevenue: bestProductId ? (revenueByProduct.get(bestProductId) ?? 0) : 0,
      topCustomer,
      pending,
      producing,
      late,
      upcoming,
      plannedQty,
      comparison,
    };
  }, [sales, expenses, products, orders, animals, finance, movements]);

  return (
    <div className="page-enter mx-auto max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold lg:text-3xl">Painel gerencial</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Visão do mês, estoque, vendas e produção da Fazenda Scott
          </p>
        </div>
        <ExportButtons
          targetRef={reportRef}
          report={() => ({
            title: "Visao Geral",
            columns: [{ header: "Indicador" }, { header: "Valor", align: "right" }],
            rows: [
              ["Faturamento do mes", formatBRL(m.revenueMonth)],
              ["Gastos do mes", formatBRL(m.expensesMonth)],
              ["Lucro liquido do mes", formatBRL(m.profitMonth)],
              ["Margem de lucro", `${m.marginMonth.toFixed(2)}%`],
              ["Contas a pagar", formatBRL(m.toPay)],
              ["Contas a receber", formatBRL(m.toReceive)],
              ["Saldo disponivel", formatBRL(m.balance)],
              ["Vendas hoje", formatBRL(m.salesToday)],
              ["Vendas da semana", formatBRL(m.salesWeek)],
              ["Vendas do mes", formatBRL(m.revenueMonth)],
              ["Produto mais vendido", m.bestProduct?.name ?? "—"],
              ["Cliente que mais compra", m.topCustomer?.[0] ?? "—"],
              ["Encomendas pendentes", String(m.pending.length)],
              ["Encomendas atrasadas", String(m.late.length)],
              ["Producao em andamento", String(m.producing.length)],
              ["Producao prevista (qtd.)", formatQty(m.plannedQty)],
              ["Produtos em falta", String(m.outOfStock.length)],
              ["Produtos abaixo do minimo", String(m.belowMin.length)],
              ["Produtos parados", String(m.idle.length)],
              ["Valor total do estoque", formatBRL(m.totalStockValue)],
              ...m.comparison.map((c) => [
                `${c.label}: vendas / gastos / lucro`,
                `${formatBRL(c.rev)} / ${formatBRL(c.exp)} / ${formatBRL(c.profit)}`,
              ]),
            ],
          })}
        />
      </div>

      <div ref={reportRef} className="mt-6 space-y-8">
        {/* Financeiro */}
        <section>
          <SectionTitle icon={<Wallet className="h-4 w-4" />} title="Financeiro" to="/financeiro" linkLabel="Ver financeiro" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              icon={<TrendingUp className="h-5 w-5" />}
              label="Faturamento do mês"
              value={formatBRL(m.revenueMonth)}
            />
            <StatCard
              icon={<TrendingDown className="h-5 w-5" />}
              label="Gastos do mês"
              value={formatBRL(m.expensesMonth)}
            />
            <StatCard
              icon={<Wallet className="h-5 w-5" />}
              label="Lucro líquido"
              value={formatBRL(m.profitMonth)}
              highlight={m.profitMonth >= 0 ? "positive" : "negative"}
            />
            <StatCard
              icon={<Percent className="h-5 w-5" />}
              label="Margem de lucro"
              value={`${m.marginMonth.toFixed(1)}%`}
              highlight={m.marginMonth >= 0 ? "positive" : "negative"}
            />
            <StatCard
              icon={<ArrowDownCircle className="h-5 w-5" />}
              label="Contas a pagar"
              value={formatBRL(m.toPay)}
            />
            <StatCard
              icon={<ArrowUpCircle className="h-5 w-5" />}
              label="Contas a receber"
              value={formatBRL(m.toReceive)}
            />
            <StatCard
              icon={<Wallet className="h-5 w-5" />}
              label="Saldo disponível"
              value={formatBRL(m.balance)}
              highlight={m.balance >= 0 ? "positive" : "negative"}
            />
            <StatCard
              icon={<AlertTriangle className="h-5 w-5" />}
              label="Contas atrasadas"
              value={String(m.lateFinance)}
              highlight={m.lateFinance > 0 ? "negative" : undefined}
            />
          </div>
        </section>

        {/* Comparativo mensal */}
        <section className="card-farm p-5">
          <h2 className="text-lg font-bold">Comparativo mensal</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">Últimos 3 meses</p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[420px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-3"> </th>
                  {m.comparison.map((c) => (
                    <th key={c.key} className="py-2 pr-3 text-right">
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                <tr>
                  <td className="py-2.5 pr-3 font-semibold">Vendas</td>
                  {m.comparison.map((c) => (
                    <td key={c.key} className="py-2.5 pr-3 text-right">
                      {formatBRL(c.rev)}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-2.5 pr-3 font-semibold">Gastos</td>
                  {m.comparison.map((c) => (
                    <td key={c.key} className="py-2.5 pr-3 text-right">
                      {formatBRL(c.exp)}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-2.5 pr-3 font-semibold">Lucro</td>
                  {m.comparison.map((c) => (
                    <td
                      key={c.key}
                      className={`py-2.5 pr-3 text-right font-semibold ${
                        c.profit >= 0 ? "text-success" : "text-destructive"
                      }`}
                    >
                      {formatBRL(c.profit)}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Vendas */}
        <section>
          <SectionTitle icon={<TrendingUp className="h-4 w-4" />} title="Vendas" to="/vendas" linkLabel="Ver vendas" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard icon={<TrendingUp className="h-5 w-5" />} label="Vendas hoje" value={formatBRL(m.salesToday)} />
            <StatCard icon={<TrendingUp className="h-5 w-5" />} label="Vendas da semana" value={formatBRL(m.salesWeek)} />
            <StatCard icon={<TrendingUp className="h-5 w-5" />} label="Vendas do mês" value={formatBRL(m.revenueMonth)} />
            <StatCard
              icon={<Users className="h-5 w-5" />}
              label="Cliente que mais compra"
              value={m.topCustomer?.[0] ?? "—"}
              hint={m.topCustomer ? formatBRL(m.topCustomer[1]) : undefined}
            />
            <StatCard
              icon={<Package className="h-5 w-5" />}
              label="Produto mais vendido"
              value={m.bestProduct?.name ?? "—"}
              hint={m.bestProduct ? formatBRL(m.bestProductRevenue) : undefined}
            />
          </div>
        </section>

        {/* Estoque */}
        <section>
          <SectionTitle icon={<Warehouse className="h-4 w-4" />} title="Estoque" to="/produtos" linkLabel="Ver produtos" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              icon={<Warehouse className="h-5 w-5" />}
              label="Valor total do estoque"
              value={formatBRL(m.totalStockValue)}
              highlight="positive"
            />
            <StatCard icon={<Package className="h-5 w-5" />} label="Estoque de produtos" value={formatBRL(m.productsStockValue)} />
            <StatCard
              icon={<Beef className="h-5 w-5" />}
              label={`Rebanho (${formatQty(m.animalsAlive)} cab.)`}
              value={formatBRL(m.animalsStockValue)}
            />
            <StatCard
              icon={<AlertTriangle className="h-5 w-5" />}
              label="Produtos em falta"
              value={String(m.outOfStock.length)}
              highlight={m.outOfStock.length > 0 ? "negative" : undefined}
            />
          </div>
          <div className="mt-4 grid gap-6 lg:grid-cols-3">
            <ListCard
              title={`Abaixo do mínimo (${MIN_STOCK})`}
              empty="Todos os produtos com estoque saudável."
              items={m.belowMin.slice(0, 6).map((p) => ({
                id: p.id,
                left: p.name,
                right: `${formatQty(Number(p.stock))} ${p.unit}`,
                tone: "warning" as const,
              }))}
            />
            <ListCard
              title="Maior saída"
              empty="Sem saídas registradas ainda."
              items={m.topOut.map((r) => ({
                id: r.product!.id,
                left: r.product!.name,
                right: `${formatQty(r.qty)} ${r.product!.unit}`,
              }))}
            />
            <ListCard
              title="Produtos parados"
              empty="Todos os produtos tiveram movimentação."
              items={m.idle.slice(0, 6).map((p) => ({
                id: p.id,
                left: p.name,
                right: `${formatQty(Number(p.stock))} ${p.unit}`,
              }))}
            />
          </div>
        </section>

        {/* Produção */}
        <section>
          <SectionTitle icon={<Factory className="h-4 w-4" />} title="Produção" to="/encomendas" linkLabel="Ver encomendas" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard icon={<ClipboardList className="h-5 w-5" />} label="Encomendas pendentes" value={String(m.pending.length)} />
            <StatCard
              icon={<AlertTriangle className="h-5 w-5" />}
              label="Encomendas atrasadas"
              value={String(m.late.length)}
              highlight={m.late.length > 0 ? "negative" : undefined}
            />
            <StatCard icon={<Factory className="h-5 w-5" />} label="Produção em andamento" value={String(m.producing.length)} />
            <StatCard
              icon={<CalendarClock className="h-5 w-5" />}
              label="Produção prevista"
              value={formatQty(m.plannedQty)}
              hint={`${m.upcoming.length} encomenda(s) na fila`}
            />
          </div>
          {m.upcoming.length > 0 && (
            <div className="mt-4 card-farm p-5">
              <h3 className="text-base font-bold">Próximas entregas</h3>
              <ul className="mt-2 divide-y divide-border">
                {m.upcoming.slice(0, 5).map((o) => (
                  <li key={o.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {o.customer} — {o.products?.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatQty(Number(o.quantity))} {o.products?.unit} · Entrega:{" "}
                        {formatDate(o.due_date)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {/* Últimas vendas */}
        <section className="card-farm p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold">Últimas vendas</h2>
            <Link to="/vendas" className="text-sm font-semibold text-primary hover:underline">
              Ver vendas
            </Link>
          </div>
          {sales.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma venda registrada ainda.</p>
          ) : (
            <ul className="divide-y divide-border">
              {sales.slice(0, 8).map((s) => (
                <li key={s.id} className="flex items-center justify-between py-2 text-sm">
                  <div>
                    <p className="font-medium">{s.products?.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(s.date)} · {formatQty(Number(s.quantity))} {s.products?.unit}
                    </p>
                  </div>
                  <span className="font-semibold text-success">{formatBRL(Number(s.total))}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function SectionTitle({
  icon,
  title,
  to,
  linkLabel,
}: {
  icon: React.ReactNode;
  title: string;
  to: string;
  linkLabel: string;
}) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="flex items-center gap-2 text-lg font-bold">
        <span className="rounded-md bg-accent p-1.5 text-accent-foreground">{icon}</span>
        {title}
      </h2>
      <Link to={to} className="text-sm font-semibold text-primary hover:underline">
        {linkLabel}
      </Link>
    </div>
  );
}

function ListCard({
  title,
  items,
  empty,
}: {
  title: string;
  items: { id: string; left: string; right: string; tone?: "warning" }[];
  empty: string;
}) {
  return (
    <div className="card-farm p-5">
      <h3 className="text-base font-bold">{title}</h3>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="mt-2 divide-y divide-border">
          {items.map((it) => (
            <li key={it.id} className="flex items-center justify-between gap-2 py-2 text-sm">
              <span className="truncate">{it.left}</span>
              <span
                className={`shrink-0 font-semibold ${
                  it.tone === "warning" ? "text-destructive" : "text-foreground"
                }`}
              >
                {it.right}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  highlight,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  highlight?: "positive" | "negative";
  hint?: string;
}) {
  return (
    <div className="card-farm hover-lift p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <span className="rounded-md bg-accent p-1.5 text-accent-foreground">{icon}</span>
        <span className="text-xs font-semibold uppercase tracking-wide">{label}</span>
      </div>
      <p
        className={`mt-3 truncate text-2xl font-bold ${
          highlight === "positive"
            ? "text-success"
            : highlight === "negative"
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
