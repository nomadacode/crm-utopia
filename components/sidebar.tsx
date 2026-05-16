"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Columns,
  MessageCircle,
  Settings,
  Sparkles,
  TestTube2,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: BarChart3 },
  { href: "/conversations", label: "Conversaciones", icon: MessageCircle },
  { href: "/pipeline", label: "Pipeline", icon: Columns },
  { href: "/test-chat", label: "Test chat", icon: TestTube2 },
  { href: "/settings", label: "Ajustes", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="flex h-screen w-56 flex-col border-r border-sidebar-border bg-sidebar px-3 py-5">
      <div className="mb-8 flex items-center gap-2.5 px-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-foreground text-background">
          <Sparkles className="h-3.5 w-3.5" />
        </div>
        <div className="leading-tight">
          <div className="text-sm font-medium">UtopIA</div>
          <div className="text-[11px] text-muted-foreground">CRM WhatsApp</div>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5">
        {ITEMS.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
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
    </aside>
  );
}
