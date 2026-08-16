import { useEffect, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Package,
  ArrowLeftRight,
  ShoppingCart,
  ClipboardList,
  Receipt,
  LogOut,
  Menu,
  Beef,
  Table2,
  Wallet,
} from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { FarmBackground } from "@/components/farm/FarmBackground";
import logoAsset from "@/assets/fazenda-scott-logo.png.asset.json";

const NAV = [
  { to: "/", label: "Painel", icon: LayoutDashboard },
  { to: "/produtos", label: "Produtos", icon: Package },
  { to: "/animais", label: "Animais", icon: Beef },
  { to: "/movimentacoes", label: "Entradas e Saídas", icon: ArrowLeftRight },
  { to: "/vendas", label: "Vendas", icon: ShoppingCart },
  { to: "/encomendas", label: "Encomendas", icon: ClipboardList },
  { to: "/gastos", label: "Gastos", icon: Receipt },
  { to: "/financeiro", label: "Financeiro", icon: Wallet },
  { to: "/precos", label: "Tabela de Preços", icon: Table2 },
];


export function AppLayout({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!loading && !session) {
      navigate({ to: "/auth" });
    }
  }, [loading, session, navigate]);

  if (loading || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <img src={logoAsset.url} alt="Fazenda Scott" className="h-32 w-32 animate-pulse object-contain" />
      </div>
    );
  }

  const nav = (
    <nav className="flex flex-col gap-1 px-3">
      {NAV.map((item) => {
        const active = pathname === item.to;
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={() => setMobileOpen(false)}
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-all duration-200 hover:translate-x-1 ${
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
            }`}
          >
            <item.icon className="h-4 w-4 shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="flex min-h-screen">
      <FarmBackground />
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col bg-sidebar/95 backdrop-blur-md lg:flex">

        <div className="flex flex-col items-center px-4 py-6">
          <img src={logoAsset.url} alt="Fazenda Scott" className="h-28 w-28 object-contain" />
          <p className="mt-2 text-center text-xs font-medium tracking-wide text-sidebar-accent-foreground">
            Da terra para você
          </p>
        </div>
        {nav}
        <div className="mt-auto border-t border-sidebar-border p-3">
          <p className="mb-2 truncate px-3 text-xs text-sidebar-foreground/60">
            {session.user.email}
          </p>
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              navigate({ to: "/auth" });
            }}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
          >
            <LogOut className="h-4 w-4" /> Sair
          </button>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="fixed inset-x-0 top-0 z-40 flex items-center justify-between bg-sidebar px-4 py-3 lg:hidden">
        <div className="flex items-center gap-2">
          <img src={logoAsset.url} alt="Fazenda Scott" className="h-10 w-10 object-contain" />
          <span className="font-display text-lg font-bold text-sidebar-accent-foreground">
            Fazenda Scott
          </span>
        </div>
        <button
          onClick={() => setMobileOpen((v) => !v)}
          className="rounded-md p-2 text-sidebar-foreground"
          aria-label="Menu"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>
      {mobileOpen && (
        <div className="fixed inset-x-0 top-14 z-40 bg-sidebar pb-4 pt-2 shadow-lg lg:hidden">
          {nav}
          <div className="mt-2 border-t border-sidebar-border px-3 pt-2">
            <button
              onClick={async () => {
                await supabase.auth.signOut();
                navigate({ to: "/auth" });
              }}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold text-sidebar-foreground/80"
            >
              <LogOut className="h-4 w-4" /> Sair
            </button>
          </div>
        </div>
      )}

      <main key={pathname} className="page-enter min-w-0 flex-1 px-4 pb-12 pt-20 lg:ml-60 lg:px-8 lg:pt-8">
        {children}
      </main>
    </div>
  );
}
