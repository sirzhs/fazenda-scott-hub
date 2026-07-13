import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Wallet, TrendingUp, TrendingDown, Package, ClipboardList, Warehouse, Beef } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { AppLayout } from "@/components/farm/AppLayout";
import { formatBRL, formatQty, formatDate } from "@/lib/farm";

export const Route = createFileRoute("/")({
  component: () => (
    <AppLayout>
      <Dashboard />
    </AppLayout>
  ),
});

function Dashboard() {
  const { userId } = useAuth();

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

  const { data: pendingOrders = [] } = useQuery({
    queryKey: ["orders-pending", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, products(name, unit)")
        .in("status", ["pendente", "em_producao"])
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

  const totalSales = sales.reduce((sum, s) => sum + Number(s.total), 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const balance = totalSales - totalExpenses;
  const lowStock = products.filter((p) => Number(p.stock) <= 0);
  const productsStockValue = products.reduce(
    (sum, p) => sum + Number(p.stock) * Number(p.price),
    0,
  );
  const animalsAlive = animals.reduce(
    (sum, a) => sum + Math.max(Number(a.purchased) - Number(a.slaughtered), 0),
    0,
  );
  const animalsStockValue = animals.reduce(
    (sum, a) =>
      sum +
      Math.max(Number(a.purchased) - Number(a.slaughtered), 0) * Number(a.unit_value),
    0,
  );
  const totalStockValue = productsStockValue + animalsStockValue;

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl font-bold lg:text-3xl">Painel da Fazenda</h1>
      <p className="mt-1 text-sm text-muted-foreground">Visão geral do seu negócio</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<Wallet className="h-5 w-5" />}
          label="Saldo da conta"
          value={formatBRL(balance)}
          highlight={balance >= 0 ? "positive" : "negative"}
        />
        <StatCard
          icon={<TrendingUp className="h-5 w-5" />}
          label="Total de vendas"
          value={formatBRL(totalSales)}
        />
        <StatCard
          icon={<TrendingDown className="h-5 w-5" />}
          label="Total de gastos"
          value={formatBRL(totalExpenses)}
        />
        <StatCard
          icon={<ClipboardList className="h-5 w-5" />}
          label="Encomendas abertas"
          value={String(pendingOrders.length)}
        />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          icon={<Warehouse className="h-5 w-5" />}
          label="Valor do estoque"
          value={formatBRL(totalStockValue)}
          highlight="positive"
        />
        <StatCard
          icon={<Package className="h-5 w-5" />}
          label="Estoque de produtos"
          value={formatBRL(productsStockValue)}
        />
        <StatCard
          icon={<Beef className="h-5 w-5" />}
          label={`Rebanho (${formatQty(animalsAlive)} cab.)`}
          value={formatBRL(animalsStockValue)}
        />
      </div>


      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold">Estoque</h2>
            <Link to="/produtos" className="text-sm font-semibold text-primary hover:underline">
              Ver produtos
            </Link>
          </div>
          {products.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum produto cadastrado ainda.{" "}
              <Link to="/produtos" className="font-semibold text-primary hover:underline">
                Cadastrar produtos
              </Link>
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {products.slice(0, 8).map((p) => (
                <li key={p.id} className="flex items-center justify-between py-2 text-sm">
                  <span className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-gold" />
                    {p.name}
                  </span>
                  <span
                    className={`font-semibold ${Number(p.stock) <= 0 ? "text-destructive" : "text-foreground"}`}
                  >
                    {formatQty(Number(p.stock))} {p.unit}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {lowStock.length > 0 && (
            <p className="mt-3 rounded-md bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive">
              {lowStock.length} produto(s) sem estoque
            </p>
          )}
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
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

      {pendingOrders.length > 0 && (
        <section className="mt-6 rounded-xl border border-border bg-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold">Próximas encomendas</h2>
            <Link to="/encomendas" className="text-sm font-semibold text-primary hover:underline">
              Ver encomendas
            </Link>
          </div>
          <ul className="divide-y divide-border">
            {pendingOrders.slice(0, 5).map((o) => (
              <li key={o.id} className="flex items-center justify-between py-2 text-sm">
                <div>
                  <p className="font-medium">
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
        </section>
      )}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  highlight?: "positive" | "negative";
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <span className="rounded-md bg-accent p-1.5 text-accent-foreground">{icon}</span>
        <span className="text-xs font-semibold uppercase tracking-wide">{label}</span>
      </div>
      <p
        className={`mt-3 text-2xl font-bold ${
          highlight === "positive"
            ? "text-success"
            : highlight === "negative"
              ? "text-destructive"
              : "text-card-foreground"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
