"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Trash2 } from "lucide-react";
import type { ContactNote } from "@/lib/types";

export function NotesPanel({
  contactId,
  initialNotes,
}: {
  contactId: string;
  initialNotes: ContactNote[];
}) {
  const [notes, setNotes] = useState<ContactNote[]>(initialNotes);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  async function addNote() {
    const trimmed = draft.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/contacts/${contactId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: trimmed }),
      });
      if (res.ok) {
        const note = (await res.json()) as ContactNote;
        setNotes((prev) => [note, ...prev]);
        setDraft("");
      }
    } finally {
      setSaving(false);
    }
  }

  async function removeNote(id: string) {
    if (!confirm("¿Eliminar esta nota?")) return;
    const res = await fetch(`/api/notes/${id}`, { method: "DELETE" });
    if (res.ok) setNotes((prev) => prev.filter((n) => n.id !== id));
  }

  return (
    <Card className="rounded-lg p-5 space-y-3">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">
        Notas privadas
      </div>

      <div className="space-y-2">
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Nota privada, no la ve UtopIA…"
          rows={2}
          className="text-sm"
        />
        <Button
          size="sm"
          onClick={addNote}
          disabled={!draft.trim() || saving}
          className="w-full"
        >
          {saving ? "Guardando…" : "Agregar nota"}
        </Button>
      </div>

      {notes.length > 0 && (
        <ul className="space-y-2 border-t border-border pt-3">
          {notes.map((n) => (
            <li
              key={n.id}
              className="group rounded-md bg-muted/50 px-3 py-2 text-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="whitespace-pre-wrap leading-snug">{n.content}</p>
                <button
                  onClick={() => removeNote(n.id)}
                  className="opacity-0 transition-opacity group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                  aria-label="Eliminar nota"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="mt-1 text-[10px] tabular text-muted-foreground">
                {new Date(n.created_at).toLocaleString("es-AR", {
                  day: "2-digit",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
