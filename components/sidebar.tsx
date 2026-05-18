"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Columns,
  Flame,
  Menu,
  MessageCircle,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Sparkles,
  TestTube2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: BarChart3 },
  { href: "/conversations", label: "Conversaciones", icon: MessageCircle },
  { href: "/leads", label: "Leads", icon: Flame },
  { href: "/pipeline", label: "Pipeline", icon: Columns },
  { href: "/test-chat", label: "Test chat", icon: TestTube2 },
  { href: "/settings", label: "Ajustes", icon: Settings },
];

const STORAGE_KEY = "utopia.sidebar.collapsed";

function NavList({
  collapsed = false,
  onNavigate,
}: {
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-1 flex-col gap-0.5">
      {ITEMS.map((item) => {
        const active =
          pathname === item.href || pathname.startsWith(item.href + "/");
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            title={collapsed ? item.label : undefined}
            className={cn(
              "flex items-center gap-2.5 rounded-md text-sm transition-colors",
              collapsed ? "h-9 w-9 justify-center" : "px-2.5 py-2",
              active
                ? "bg-foreground text-background"
                : "text-foreground/80 hover:bg-sidebar-accent hover:text-foreground",
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {!collapsed && <span className="truncate">{item.label}</span>}
          </Link>
        );
      })}
    </nav>
  );
}

function Brand({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <div
      className={cn(
        "flex items-center gap-2.5",
        collapsed ? "justify-center" : "px-2",
      )}
    >
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-foreground text-background">
        <Sparkles className="h-3.5 w-3.5" />
      </div>
      {!collapsed && (
        <div className="leading-tight">
          <div className="text-sm font-medium">UtopIA</div>
          <div className="text-[11px] text-muted-foreground">CRM</div>
        </div>
      )}
    </div>
  );
}

export function Sidebar() {
  const [open, setOpen] = useState(false); // mobile drawer
  const [collapsed, setCollapsed] = useState(false); // desktop collapse
  const [hydrated, setHydrated] = useState(false);

  // Restore collapsed state from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "1") setCollapsed(true);
    } catch {
      // ignore (private mode, etc.)
    }
    setHydrated(true);
  }, []);

  function toggleCollapsed() {
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        // ignore
      }
      return next;
    });
  }

  return (
    <>
      {/* Mobile top bar (visible <md) */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-sidebar px-3 md:hidden">
        <button
          onClick={() => setOpen(true)}
          aria-label="Abrir menú"
          className="rounded-md p-2 hover:bg-sidebar-accent"
        >
          <Menu className="h-5 w-5" />
        </button>
        <Brand />
        <div className="w-9" />
      </div>

      {/* Mobile drawer */}
      {open && (
        <>
          <div
            className="fixed inset-0 z-40 bg-foreground/40 md:hidden"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <aside className="fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-sidebar-border bg-sidebar px-3 py-4 md:hidden">
            <div className="mb-6 flex items-center justify-between">
              <Brand />
              <button
                onClick={() => setOpen(false)}
                aria-label="Cerrar menú"
                className="rounded-md p-2 hover:bg-sidebar-accent"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <NavList onNavigate={() => setOpen(false)} />
          </aside>
        </>
      )}

      {/* Desktop sidebar (>=md), collapsible */}
      <aside
        className={cn(
          "hidden h-screen shrink-0 flex-col border-r border-sidebar-border bg-sidebar py-5 transition-[width] duration-200 md:flex",
          collapsed ? "w-14 px-2" : "w-56 px-3",
          // Avoid flash of wrong-width before hydration restores localStorage
          !hydrated && "opacity-0",
        )}
      >
        <div
          className={cn(
            "mb-8 flex items-center",
            collapsed ? "justify-center" : "justify-between gap-2",
          )}
        >
          <Brand collapsed={collapsed} />
          {!collapsed && (
            <button
              onClick={toggleCollapsed}
              aria-label="Colapsar barra lateral"
              title="Colapsar"
              className="rounded-md p-1.5 text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
            >
              <PanelLeftClose className="h-4 w-4" />
            </button>
          )}
        </div>
        {collapsed && (
          <button
            onClick={toggleCollapsed}
            aria-label="Expandir barra lateral"
            title="Expandir"
            className="mb-2 flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
          >
            <PanelLeftOpen className="h-4 w-4" />
          </button>
        )}
        <NavList collapsed={collapsed} />
      </aside>
    </>
  );
}
