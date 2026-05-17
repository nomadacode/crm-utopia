"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Columns,
  Menu,
  MessageCircle,
  Settings,
  Sparkles,
  TestTube2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: BarChart3 },
  { href: "/conversations", label: "Conversaciones", icon: MessageCircle },
  { href: "/pipeline", label: "Pipeline", icon: Columns },
  { href: "/test-chat", label: "Test chat", icon: TestTube2 },
  { href: "/settings", label: "Ajustes", icon: Settings },
];

function NavList({ onNavigate }: { onNavigate?: () => void }) {
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
            className={cn(
              "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors",
              active
                ? "bg-foreground text-background"
                : "text-foreground/80 hover:bg-sidebar-accent hover:text-foreground",
            )}
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-2.5 px-2">
      <div className="flex h-7 w-7 items-center justify-center rounded-md bg-foreground text-background">
        <Sparkles className="h-3.5 w-3.5" />
      </div>
      <div className="leading-tight">
        <div className="text-sm font-medium">UtopIA</div>
        <div className="text-[11px] text-muted-foreground">CRM</div>
      </div>
    </div>
  );
}

export function Sidebar() {
  const [open, setOpen] = useState(false);

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

      {/* Desktop sidebar (visible >=md) */}
      <aside className="hidden h-screen w-56 shrink-0 flex-col border-r border-sidebar-border bg-sidebar px-3 py-5 md:flex">
        <div className="mb-8">
          <Brand />
        </div>
        <NavList />
      </aside>
    </>
  );
}
