"use client";

import { useState } from "react";
import { PanelRight } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

/**
 * Wraps the right-hand info panels (lead, deal, tags, reminders, notes, controls)
 * in a fixed sidebar on desktop and a slide-over sheet on mobile.
 */
export function InfoPanel({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Mobile trigger button (floating) */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger
          className="fixed bottom-20 right-4 z-30 flex h-11 w-11 items-center justify-center rounded-full bg-foreground text-background shadow-lg md:hidden"
          aria-label="Abrir info del contacto"
        >
          <PanelRight className="h-5 w-5" />
        </SheetTrigger>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-sm">
          <SheetHeader>
            <SheetTitle>Información del contacto</SheetTitle>
          </SheetHeader>
          <div className="space-y-4">{children}</div>
        </SheetContent>
      </Sheet>

      {/* Desktop sidebar (>=lg) */}
      <div className="hidden space-y-4 overflow-y-auto lg:block">{children}</div>
    </>
  );
}
